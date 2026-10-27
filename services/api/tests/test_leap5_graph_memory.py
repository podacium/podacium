"""
tests/test_leap5_graph_memory.py
Unit tests for Leap 5: Episodic GraphRAG Memory Engine.
"""

import pytest
from app.agent.memory.graph_memory import (
    EpisodicGraphMemory,
    RelationType,
    MasteryState,
)


@pytest.fixture
def memory_engine():
    return EpisodicGraphMemory()


def test_entity_and_relation_extraction(memory_engine):
    text = (
        "Student is studying Python and FastAPI to build Web Services "
        "complying with Article 169 CIDTA and registered under Loi 22-23."
    )
    nodes, edges = memory_engine.extract_entities_and_relations(text)

    node_names = [n.name for n in nodes]
    assert "Python" in node_names
    assert "FastAPI" in node_names
    assert "Article 169 CIDTA" in node_names

    # Prerequisite edge should be discovered: Python -> FastAPI
    prereq_edges = [
        e for e in edges if e.relation_type == RelationType.PREREQUISITE_OF.value
    ]
    assert len(prereq_edges) >= 1


def test_record_episode_and_hierarchical_communities(memory_engine):
    ep1 = memory_engine.record_episode(
        user_id=101,
        content="Exploring React and Next.js frontend architecture with TypeScript.",
        trajectory_updates=[
            {
                "concept_id": "react",
                "concept_name": "React",
                "mastery_state": "MASTERED",
            },
            {
                "concept_id": "nextjs",
                "concept_name": "Next.js",
                "mastery_state": "PRACTICING",
            },
        ],
    )
    assert ep1.id.startswith("ep_")
    assert len(ep1.entity_ids) >= 2

    # Check communities
    communities = memory_engine.build_hierarchical_communities()
    assert 0 in communities
    assert 1 in communities
    assert 2 in communities
    assert len(communities[0]) >= 1  # Micro
    assert len(communities[1]) >= 1  # Meso
    assert len(communities[2]) >= 1  # Macro root


def test_rrf_tri_channel_search(memory_engine):
    memory_engine.record_episode(
        user_id=202,
        content="Advanced data pipelines using Python, Docker, Celery, and PostgreSQL.",
    )
    memory_engine.record_episode(
        user_id=202,
        content="Accounting compliance with Compte 6181 and Compte 6186 under Algerian SCF.",
    )

    results = memory_engine.search("Python pipelines Docker", top_k=3)
    assert len(results) > 0

    top_result = results[0]
    assert "rrf_score" in top_result
    assert "channel_ranks" in top_result
    assert top_result["channel_ranks"]["dense_rank"] >= 1
    assert top_result["channel_ranks"]["sparse_rank"] >= 1
    assert top_result["channel_ranks"]["graph_rank"] >= 1


def test_learning_trajectory_and_skill_gap_diagnosis(memory_engine):
    # Record prerequisite chain in memory: python (source) -> fastapi (target)
    memory_engine.record_episode(
        user_id=303,
        content="Python is prerequisite for FastAPI microservices.",
    )

    # User 303 has not mastered python yet
    gaps = memory_engine.diagnose_skill_gaps(
        user_id=303, target_concept_id="ent_fastapi"
    )
    assert "missing_prerequisites" in gaps
    # Mark user as having studied Python
    memory_engine.record_learning_event(
        user_id=303,
        concept_id="ent_python",
        concept_name="Python",
        mastery_state=MasteryState.MASTERED.value,
    )

    trajectory = memory_engine.get_learning_trajectory(user_id=303)
    assert len(trajectory) == 1
    assert trajectory[0].concept_name == "Python"
    assert trajectory[0].mastery_state == MasteryState.MASTERED.value

    # Next step recommendation
    rec = memory_engine.suggest_next_pedagogical_step(user_id=303)
    assert "recommendation_type" in rec
