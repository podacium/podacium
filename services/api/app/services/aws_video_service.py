"""AWS Video Service — S3 upload, CloudFront signed URLs, MediaConvert transcoding."""

import os
import uuid
import logging
import asyncio
from datetime import datetime, timedelta, timezone
from pathlib import Path

import boto3
from botocore.signers import CloudFrontSigner
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

logger = logging.getLogger(__name__)


class AWSVideoService:
    def __init__(self):
        self.region = os.getenv("AWS_REGION", "us-east-1")
        self.video_bucket = os.getenv("AWS_S3_VIDEO_BUCKET", "podacium-videos-2026")
        self.cloudfront_domain = os.getenv("CLOUDFRONT_DOMAIN", "")
        self.cloudfront_key_pair_id = os.getenv("CLOUDFRONT_KEY_PAIR_ID", "")
        self.cloudfront_private_key_path = os.getenv("CLOUDFRONT_PRIVATE_KEY_PATH", "")
        self.mediaconvert_role_arn = os.getenv("MEDIACONVERT_ROLE_ARN", "")
        self.mediaconvert_endpoint = os.getenv("MEDIACONVERT_ENDPOINT", "")

        self.s3 = boto3.client("s3", region_name=self.region)
        self._cf_key = None

    @property
    def _cloudfront_key(self):
        if self._cf_key is None and self.cloudfront_private_key_path:
            with open(self.cloudfront_private_key_path, "rb") as f:
                self._cf_key = serialization.load_pem_private_key(
                    f.read(), password=None
                )
        return self._cf_key

    def _cf_signer(self):
        def rsa_signer(message):
            # CloudFront canned policy URL verification requires RSA-SHA1 signature.
            return self._cloudfront_key.sign(message, padding.PKCS1v15(), hashes.SHA1())

        return CloudFrontSigner(self.cloudfront_key_pair_id, rsa_signer)

    async def upload_video(
        self, file_content: bytes | object, filename: str, lesson_id: str
    ) -> dict:
        """Upload raw video to S3 raw/ folder. Returns S3 key."""
        ext = Path(filename).suffix or ".mp4"
        s3_key = f"raw/{lesson_id}/{uuid.uuid4().hex}{ext}"
        content_type = (
            f"video/{ext.lstrip('.')}" if ext != ".mkv" else "video/x-matroska"
        )

        if isinstance(file_content, (bytes, bytearray)):
            await asyncio.to_thread(
                self.s3.put_object,
                Bucket=self.video_bucket,
                Key=s3_key,
                Body=file_content,
                ContentType=content_type,
            )
        else:
            await asyncio.to_thread(
                self.s3.upload_fileobj,
                file_content,
                self.video_bucket,
                s3_key,
                ExtraArgs={"ContentType": content_type},
            )
        logger.info(f"Uploaded video to s3://{self.video_bucket}/{s3_key}")
        return {"raw_path": s3_key}

    def extract_video_duration(self, file_obj) -> tuple:
        """Extract video duration from file_obj stream position 0.

        Returns (duration_seconds, duration_minutes, formatted_string)
        e.g., (305, 5, "5m 5s"). Position in file_obj is reset to 0 afterwards.
        """
        try:
            from tinytag import TinyTag

            if hasattr(file_obj, "seek"):
                file_obj.seek(0)
            tag = TinyTag.get(file_obj=file_obj)
            duration_secs = int(round(tag.duration)) if tag and tag.duration else 0
        except Exception as e:
            logger.warning(f"Could not extract video duration via tinytag: {e}")
            duration_secs = 0
        finally:
            if hasattr(file_obj, "seek"):
                file_obj.seek(0)

        duration_mins = (
            max(1, int(round(duration_secs / 60.0))) if duration_secs > 0 else 0
        )
        h = duration_secs // 3600
        m = (duration_secs % 3600) // 60
        s = duration_secs % 60

        if h > 0:
            formatted = f"{h}h {m}m"
        elif m > 0:
            formatted = f"{m}m {s}s" if s > 0 else f"{m}m"
        elif s > 0:
            formatted = f"{s}s"
        else:
            formatted = "0s"

        return (duration_secs, duration_mins, formatted)

    def upload_video_stream(self, file_obj, filename: str, lesson_id: str) -> dict:
        """Stream an open file-like object to S3 without buffering it in memory.

        Uses boto3's multipart upload (transfer manager) which reads the source
        in parts, so arbitrarily large (but validated <= 2 GB) videos never
        reside fully in API process memory. `file_obj` must be positioned at 0.
        Returns the S3 key. Raises on failure.
        """
        import botocore.exceptions

        ext = Path(filename).suffix or ".mp4"
        s3_key = f"raw/{lesson_id}/{uuid.uuid4().hex}{ext}"

        content_type = "video/mp4"
        if ext == ".mov":
            content_type = "video/quicktime"
        elif ext == ".mkv":
            content_type = "video/x-matroska"
        elif ext == ".webm":
            content_type = "video/webm"

        try:
            self.s3.upload_fileobj(
                file_obj,
                self.video_bucket,
                s3_key,
                ExtraArgs={"ContentType": content_type},
            )
        except botocore.exceptions.BotoCoreError as e:
            logger.error(f"S3 streaming upload failed for {s3_key}: {e}")
            raise
        logger.info(f"Streamed video to s3://{self.video_bucket}/{s3_key}")
        return {"raw_path": s3_key}

    def generate_signed_url(
        self, path: str, expire_minutes: int = 30, client_ip: str | None = None
    ) -> str:
        """Generate a CloudFront signed URL. Default expiry is 30m; frontend refreshes periodically.

        For HLS paths (e.g. starting with 'hls/' or ending with '.m3u8'), constructs a CloudFront
        Custom Policy with a resource wildcard ('/hls/{lesson_id}/*') so sub-playlists and .ts
        segments inherit authorization under the same signed URL signature.
        If client_ip is provided, binds the custom policy to AWS:SourceIp CIDR for anti-piracy token protection.
        """
        import json

        clean_path = path.lstrip("/")
        expire_date = datetime.now(timezone.utc) + timedelta(minutes=expire_minutes)
        signer = self._cf_signer()
        target_url = f"https://{self.cloudfront_domain}/{clean_path}"

        if clean_path.startswith("hls/") or clean_path.endswith(".m3u8") or client_ip:
            dir_parts = clean_path.split("/")
            dir_path = "/".join(dir_parts[:-1]) if len(dir_parts) > 1 else clean_path
            resource_url = f"https://{self.cloudfront_domain}/{dir_path}/*"
            epoch_time = int(expire_date.timestamp())

            conditions: dict = {"DateLessThan": {"AWS:EpochTime": epoch_time}}
            if client_ip and client_ip not in ("127.0.0.1", "localhost", "::1"):
                clean_ip = client_ip.split(",")[0].strip()
                cidr = clean_ip if "/" in clean_ip else f"{clean_ip}/32"
                conditions["IpAddress"] = {"AWS:SourceIp": cidr}

            policy_dict = {
                "Statement": [
                    {
                        "Resource": resource_url,
                        "Condition": conditions,
                    }
                ]
            }
            policy = json.dumps(policy_dict, separators=(",", ":"))
            return signer.generate_presigned_url(target_url, policy=policy)

        return signer.generate_presigned_url(target_url, date_less_than=expire_date)

    def generate_signed_cookies(
        self, lesson_id: str, expire_minutes: int = 180
    ) -> dict:
        """Generate CloudFront signed cookies with wildcard path scope for HLS playback."""
        import json
        import base64

        resource_url = f"https://{self.cloudfront_domain}/hls/{lesson_id}/*"
        epoch_time = int(
            (datetime.now(timezone.utc) + timedelta(minutes=expire_minutes)).timestamp()
        )

        policy_dict = {
            "Statement": [
                {
                    "Resource": resource_url,
                    "Condition": {"DateLessThan": {"AWS:EpochTime": epoch_time}},
                }
            ]
        }
        policy_bytes = json.dumps(policy_dict, separators=(",", ":")).encode("utf-8")

        def cf_b64encode(data: bytes) -> str:
            b64 = base64.b64encode(data).decode("utf-8")
            return b64.replace("+", "-").replace("=", "_").replace("/", "~")

        encoded_policy = cf_b64encode(policy_bytes)
        signature = self._cloudfront_key.sign(
            policy_bytes, padding.PKCS1v15(), hashes.SHA1()
        )
        encoded_signature = cf_b64encode(signature)

        return {
            "CloudFront-Policy": encoded_policy,
            "CloudFront-Signature": encoded_signature,
            "CloudFront-Key-Pair-Id": self.cloudfront_key_pair_id,
        }

    def generate_segment_token(
        self, lesson_id: str, segment_name: str, expire_seconds: int = 300
    ) -> str:
        """Generate a short-lived (300s) token for HLS video segments with seek-aware scope."""
        path = f"hls/{lesson_id}/{segment_name.lstrip('/')}"
        url = f"https://{self.cloudfront_domain}/{path}"
        expire_date = datetime.now(timezone.utc) + timedelta(seconds=expire_seconds)
        signer = self._cf_signer()
        return signer.generate_presigned_url(url, date_less_than=expire_date)

    def _get_mediaconvert_client(self):
        """Get or discover MediaConvert boto3 client without passing empty endpoint_url."""
        endpoint = (self.mediaconvert_endpoint or "").strip()
        if not endpoint:
            try:
                mc_default = boto3.client("mediaconvert", region_name=self.region)
                res = mc_default.describe_endpoints()
                if res.get("Endpoints"):
                    endpoint = res["Endpoints"][0]["Url"]
                    self.mediaconvert_endpoint = endpoint
            except Exception as err:
                logger.warning(f"Could not auto-discover MediaConvert endpoint: {err}")

        kwargs = {"region_name": self.region}
        if endpoint:
            kwargs["endpoint_url"] = endpoint
        return boto3.client("mediaconvert", **kwargs)

    def submit_transcode_job(self, raw_s3_key: str, lesson_id: str) -> str:
        """Submit MediaConvert job to transcode raw video to multi-bitrate HLS ladder."""
        if not self.mediaconvert_role_arn:
            logger.warning(
                "MEDIACONVERT_ROLE_ARN is not configured in environment variables."
            )
            raise ValueError(
                "MEDIACONVERT_ROLE_ARN is not configured in environment variables."
            )

        client = self._get_mediaconvert_client()

        input_uri = f"s3://{self.video_bucket}/{raw_s3_key}"
        output_prefix = f"s3://{self.video_bucket}/hls/{lesson_id}/"

        job_settings = {
            "Inputs": [
                {
                    "FileInput": input_uri,
                    "AudioSelectors": {
                        "Audio Selector 1": {"DefaultSelection": "DEFAULT"}
                    },
                }
            ],
            "OutputGroups": [
                {
                    "Name": "HLS",
                    "OutputGroupSettings": {
                        "Type": "HLS_GROUP_SETTINGS",
                        "HlsGroupSettings": {
                            "Destination": output_prefix,
                            "SegmentLength": 6,
                            "MinSegmentLength": 0,
                            "DirectoryStructure": "SINGLE_DIRECTORY",
                        },
                    },
                    "Outputs": [
                        self._hls_output(
                            width=640,
                            height=360,
                            bitrate=800000,
                            name="360p",
                            qvbr_quality_level=7,
                        ),
                        self._hls_output(
                            width=854,
                            height=480,
                            bitrate=1400000,
                            name="480p",
                            qvbr_quality_level=7,
                        ),
                        self._hls_output(
                            width=1280,
                            height=720,
                            bitrate=2800000,
                            name="720p",
                            qvbr_quality_level=7,
                        ),
                        self._hls_output(
                            width=1920,
                            height=1080,
                            bitrate=5500000,
                            name="1080p",
                            qvbr_quality_level=8,
                        ),
                    ],
                }
            ],
        }

        response = client.create_job(
            Role=self.mediaconvert_role_arn,
            Settings=job_settings,
        )
        job_id = response["Job"]["Id"]
        logger.info(f"MediaConvert job submitted: {job_id} for lesson {lesson_id}")
        return job_id

    def get_job_status(self, job_id: str) -> dict:
        """Check MediaConvert job status."""
        client = self._get_mediaconvert_client()
        response = client.get_job(Id=job_id)
        job = response["Job"]
        return {"status": job["Status"], "progress": job.get("JobPercentComplete", 0)}

    @staticmethod
    def _hls_output(
        width: int,
        height: int,
        bitrate: int,
        name: str,
        rate_control_mode: str = "QVBR",
        qvbr_quality_level: int = 7,
    ) -> dict:
        h264_settings = {
            "GopSize": 2.0,
            "GopSizeUnits": "SECONDS",
            "SceneChangeDetect": "DISABLED",
            "GopClosedCadence": 1,
        }

        if rate_control_mode.upper() == "QVBR":
            h264_settings["RateControlMode"] = "QVBR"
            h264_settings["MaxBitrate"] = bitrate
            h264_settings["QvbrSettings"] = {"QvbrQualityLevel": qvbr_quality_level}
        else:
            h264_settings["RateControlMode"] = rate_control_mode.upper()
            h264_settings["Bitrate"] = bitrate

        return {
            "NameModifier": f"_{name}",
            "ContainerSettings": {"Container": "M3U8"},
            "VideoDescription": {
                "Width": width,
                "Height": height,
                "CodecSettings": {
                    "Codec": "H_264",
                    "H264Settings": h264_settings,
                },
            },
            "AudioDescriptions": [
                {
                    "CodecSettings": {
                        "Codec": "AAC",
                        "AacSettings": {
                            "Bitrate": 128000,
                            "CodingMode": "CODING_MODE_2_0",
                            "SampleRate": 48000,
                        },
                    },
                }
            ],
        }


aws_video_service = AWSVideoService()
