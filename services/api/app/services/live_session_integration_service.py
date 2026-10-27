"""Service for integrating Live Sessions with Modules/Paths in learning paths."""

import logging
from datetime import datetime, timezone
from typing import Optional, List

from app.core.prisma import prisma

logger = logging.getLogger(__name__)


class LiveSessionIntegrationService:
    """Service for managing LiveSession <-> Module/Path relationships."""

    async def link_session_to_module(
        self, module_id: str, session_id: str, order: int = 0, is_required: bool = True
    ) -> dict:
        """
        Link a live session to a module.

        Args:
            module_id: The module ID to link
            session_id: The live session ID to link
            order: Display order within the module (default: 0)
            is_required: Whether attendance is required for module completion (default: True)

        Returns:
            The created link object

        Raises:
            ValueError: If module or session doesn't exist, or link already exists
        """
        # Verify module exists
        module = await prisma.module.find_unique(where={"id": module_id})
        if not module:
            raise ValueError(f"Module {module_id} not found")

        # Verify session exists
        session = await prisma.livesession.find_unique(where={"id": session_id})
        if not session:
            raise ValueError(f"Live session {session_id} not found")

        # Check if link already exists
        existing = await prisma.livesessionmodulelink.find_unique(
            where={
                "moduleId_liveSessionId": {
                    "moduleId": module_id,
                    "liveSessionId": session_id,
                }
            }
        )
        if existing:
            raise ValueError(
                f"Session {session_id} already linked to module {module_id}"
            )

        # Create the link
        link = await prisma.livesessionmodulelink.create(
            data={
                "moduleId": module_id,
                "liveSessionId": session_id,
                "order": order,
                "isRequired": is_required,
            }
        )

        logger.info(
            f"Linked live session {session_id} to module {module_id} (order={order}, required={is_required})"
        )
        return link.model_dump()

    async def unlink_session_from_module(self, module_id: str, session_id: str) -> bool:
        """
        Remove a live session link from a module.

        Args:
            module_id: The module ID
            session_id: The live session ID

        Returns:
            True if link was removed, False if not found
        """
        deleted = await prisma.livesessionmodulelink.delete_many(
            where={"moduleId": module_id, "liveSessionId": session_id}
        )
        return deleted > 0

    async def get_sessions_for_module(self, module_id: str) -> List[dict]:
        """
        Get all live sessions linked to a module, ordered by display order.

        Args:
            module_id: The module ID

        Returns:
            List of session objects with link metadata (order, is_required)
        """
        links = await prisma.livesessionmodulelink.find_many(
            where={"moduleId": module_id},
            include={"liveSession": True},
            order={"order": "asc"},
        )

        result = []
        for link in links:
            if link.liveSession:
                session_data = link.liveSession.model_dump()
                session_data["link_order"] = link.order
                session_data["link_is_required"] = link.isRequired
                session_data["link_id"] = link.id
                result.append(session_data)

        return result

    async def get_upcoming_sessions_for_enrollment(
        self, enrollment_id: int
    ) -> List[dict]:
        """
        Get upcoming live sessions for a user's enrollment (module or path).

        Args:
            enrollment_id: The enrollment ID

        Returns:
            List of upcoming live sessions with module context
        """
        enrollment = await prisma.enrollment.find_unique(
            where={"id": enrollment_id}, include={"module": True, "path": True}
        )

        if not enrollment:
            raise ValueError(f"Enrollment {enrollment_id} not found")

        now = datetime.now(timezone.utc)
        sessions = []

        # Get sessions for module enrollment
        if enrollment.moduleId:
            module_sessions = await prisma.livesessionmodulelink.find_many(
                where={"moduleId": enrollment.moduleId},
                include={
                    "liveSession": {
                        "where": {
                            "status": {"in": ["SCHEDULED", "LIVE"]},
                            "scheduledAt": {"gte": now},
                            "deletedAt": None,
                        }
                    }
                },
                order={"order": "asc"},
            )

            for link in module_sessions:
                if link.liveSession:
                    session_data = link.liveSession.model_dump()
                    session_data["module_id"] = enrollment.moduleId
                    session_data["module_title"] = (
                        enrollment.module.title if enrollment.module else None
                    )
                    session_data["link_order"] = link.order
                    session_data["link_is_required"] = link.isRequired
                    sessions.append(session_data)

        # Get sessions for path enrollment (all modules in the path)
        if enrollment.pathId:
            path_modules = await prisma.pathmodule.find_many(
                where={"pathId": enrollment.pathId},
                include={"module": True},
                order={"order": "asc"},
            )

            for pm in path_modules:
                if pm.module:
                    module_sessions = await prisma.livesessionmodulelink.find_many(
                        where={"moduleId": pm.module.id},
                        include={
                            "liveSession": {
                                "where": {
                                    "status": {"in": ["SCHEDULED", "LIVE"]},
                                    "scheduledAt": {"gte": now},
                                    "deletedAt": None,
                                }
                            }
                        },
                        order={"order": "asc"},
                    )

                    for link in module_sessions:
                        if link.liveSession:
                            session_data = link.liveSession.model_dump()
                            session_data["module_id"] = pm.module.id
                            session_data["module_title"] = pm.module.title
                            session_data["path_module_order"] = pm.order
                            session_data["link_order"] = link.order
                            session_data["link_is_required"] = link.isRequired
                            sessions.append(session_data)

        # Sort by scheduled time
        sessions.sort(key=lambda s: s.get("scheduledAt", ""))
        return sessions

    async def get_modules_for_session(self, session_id: str) -> List[dict]:
        """
        Get all modules linked to a live session.

        Args:
            session_id: The live session ID

        Returns:
            List of module objects with link metadata
        """
        links = await prisma.livesessionmodulelink.find_many(
            where={"liveSessionId": session_id},
            include={"module": True},
            order={"order": "asc"},
        )

        result = []
        for link in links:
            if link.module:
                module_data = link.module.model_dump()
                module_data["link_order"] = link.order
                module_data["link_is_required"] = link.isRequired
                module_data["link_id"] = link.id
                result.append(module_data)

        return result

    async def update_session_module_link(
        self,
        module_id: str,
        session_id: str,
        order: Optional[int] = None,
        is_required: Optional[bool] = None,
    ) -> Optional[dict]:
        """
        Update an existing session-module link.

        Args:
            module_id: The module ID
            session_id: The live session ID
            order: New display order (optional)
            is_required: New required status (optional)

        Returns:
            Updated link object or None if not found
        """
        link = await prisma.livesessionmodulelink.find_unique(
            where={
                "moduleId_liveSessionId": {
                    "moduleId": module_id,
                    "liveSessionId": session_id,
                }
            }
        )

        if not link:
            return None

        update_data = {}
        if order is not None:
            update_data["order"] = order
        if is_required is not None:
            update_data["isRequired"] = is_required

        if not update_data:
            return link.model_dump()

        updated = await prisma.livesessionmodulelink.update(
            where={"id": link.id}, data=update_data
        )

        logger.info(
            f"Updated live session link {link.id}: order={order}, is_required={is_required}"
        )
        return updated.model_dump()

    async def reorder_module_sessions(
        self, module_id: str, session_orders: List[dict]
    ) -> List[dict]:
        """
        Reorder all sessions for a module in a single transaction.

        Args:
            module_id: The module ID
            session_orders: List of {"session_id": str, "order": int}

        Returns:
            Updated links
        """
        results = []
        async with prisma.tx() as tx:
            for item in session_orders:
                link = await tx.livesessionmodulelink.find_unique(
                    where={
                        "moduleId_liveSessionId": {
                            "moduleId": module_id,
                            "liveSessionId": item["session_id"],
                        }
                    }
                )
                if link:
                    updated = await tx.livesessionmodulelink.update(
                        where={"id": link.id}, data={"order": item["order"]}
                    )
                    results.append(updated.model_dump())

        return results


live_session_integration_service = LiveSessionIntegrationService()
