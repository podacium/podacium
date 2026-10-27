import json
from unittest.mock import MagicMock, patch
from app.services.aws_video_service import AWSVideoService


def test_get_mediaconvert_client_empty_endpoint():
    """Test that empty string endpoint doesn't raise ValueError and omits endpoint_url when auto-discover fails."""
    service = AWSVideoService()
    service.mediaconvert_endpoint = ""

    with patch("boto3.client") as mock_boto_client:
        mock_mc = MagicMock()
        mock_mc.describe_endpoints.side_effect = Exception("No AWS creds")
        mock_boto_client.return_value = mock_mc

        service._get_mediaconvert_client()
        assert mock_boto_client.call_count >= 1
        last_call_kwargs = mock_boto_client.call_args.kwargs
        assert (
            "endpoint_url" not in last_call_kwargs
            or last_call_kwargs["endpoint_url"] != ""
        )


def test_get_mediaconvert_client_with_endpoint():
    """Test that a valid endpoint_url is passed through correctly."""
    service = AWSVideoService()
    service.mediaconvert_endpoint = "https://abc.mediaconvert.us-east-1.amazonaws.com"

    with patch("boto3.client") as mock_boto_client:
        service._get_mediaconvert_client()
        mock_boto_client.assert_called_once_with(
            "mediaconvert",
            region_name=service.region,
            endpoint_url="https://abc.mediaconvert.us-east-1.amazonaws.com",
        )


def test_generate_signed_url_hls_custom_policy():
    """Test that HLS path generates a CloudFront custom policy with resource wildcard."""
    service = AWSVideoService()
    service.cloudfront_domain = "d111.cloudfront.net"
    service.cloudfront_key_pair_id = "K1234567890"

    mock_signer = MagicMock()
    mock_signer.generate_presigned_url.return_value = (
        "https://d111.cloudfront.net/hls/lesson-1/index.m3u8?Policy=xyz"
    )

    with patch.object(service, "_cf_signer", return_value=mock_signer):
        url = service.generate_signed_url("hls/lesson-1/index.m3u8", expire_minutes=120)
        assert "Policy=" in url
        mock_signer.generate_presigned_url.assert_called_once()
        call_args, call_kwargs = mock_signer.generate_presigned_url.call_args
        assert call_args[0] == "https://d111.cloudfront.net/hls/lesson-1/index.m3u8"
        assert "policy" in call_kwargs

        # Verify JSON policy structure
        policy_obj = json.loads(call_kwargs["policy"])
        resource = policy_obj["Statement"][0]["Resource"]
        assert resource == "https://d111.cloudfront.net/hls/lesson-1/*"


def test_generate_signed_url_mp4_canned_policy():
    """Test that non-HLS MP4 path uses date_less_than canned policy."""
    service = AWSVideoService()
    service.cloudfront_domain = "d111.cloudfront.net"

    mock_signer = MagicMock()
    mock_signer.generate_presigned_url.return_value = (
        "https://d111.cloudfront.net/raw/lesson-1/video.mp4?Signature=abc"
    )

    with patch.object(service, "_cf_signer", return_value=mock_signer):
        url = service.generate_signed_url("raw/lesson-1/video.mp4", expire_minutes=60)
        assert "Signature=" in url
        mock_signer.generate_presigned_url.assert_called_once()
        _, call_kwargs = mock_signer.generate_presigned_url.call_args
        assert "date_less_than" in call_kwargs


def test_generate_segment_token():
    """Test that segment token generates short-lived presigned URL."""
    service = AWSVideoService()
    service.cloudfront_domain = "d111.cloudfront.net"

    mock_signer = MagicMock()
    mock_signer.generate_presigned_url.return_value = (
        "https://d111.cloudfront.net/hls/lesson-1/720p_0001.ts?Signature=123"
    )

    with patch.object(service, "_cf_signer", return_value=mock_signer):
        url = service.generate_segment_token(
            "lesson-1", "720p_0001.ts", expire_seconds=300
        )
        assert "Signature=" in url
        call_args, _ = mock_signer.generate_presigned_url.call_args
        assert call_args[0] == "https://d111.cloudfront.net/hls/lesson-1/720p_0001.ts"


def test_hls_output_qvbr_settings():
    """Test that _hls_output correctly configures QVBR mode."""
    output = AWSVideoService._hls_output(
        width=1920,
        height=1080,
        bitrate=5500000,
        name="1080p",
        rate_control_mode="QVBR",
        qvbr_quality_level=8,
    )
    h264 = output["VideoDescription"]["CodecSettings"]["H264Settings"]
    assert h264["RateControlMode"] == "QVBR"
    assert h264["MaxBitrate"] == 5500000
    assert h264["QvbrSettings"]["QvbrQualityLevel"] == 8
    assert output["NameModifier"] == "_1080p"


def test_submit_transcode_job_4_tier_ladder():
    """Test that submit_transcode_job submits 4-tier output ladder (360p, 480p, 720p, 1080p)."""
    service = AWSVideoService()
    service.mediaconvert_role_arn = "arn:aws:iam::123456789012:role/MediaConvertRole"
    service.video_bucket = "test-bucket"

    mock_client = MagicMock()
    mock_client.create_job.return_value = {"Job": {"Id": "job-12345"}}

    with patch.object(service, "_get_mediaconvert_client", return_value=mock_client):
        job_id = service.submit_transcode_job("raw/lesson-1/video.mp4", "lesson-1")
        assert job_id == "job-12345"
        mock_client.create_job.assert_called_once()

        call_kwargs = mock_client.create_job.call_args.kwargs
        settings = call_kwargs["Settings"]
        outputs = settings["OutputGroups"][0]["Outputs"]
        assert len(outputs) == 4
        names = [o["NameModifier"] for o in outputs]
        assert names == ["_360p", "_480p", "_720p", "_1080p"]
