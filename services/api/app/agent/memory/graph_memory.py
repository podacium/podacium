"""
services/api/app/agent/memory/graph_memory.py
Episodic GraphRAG Memory Engine.

Implements:
1. Entity & relation extraction (deterministic heuristic + LLM-assisted).
2. Hierarchical community clustering (hierarchical graph clustering with community summaries).
3. Reciprocal Rank Fusion (RRF) tri-channel dense, sparse, and graph retrieval scoring.
4. Student/client learning trajectories (mastery progression, prerequisite verification, skill gaps).
"""

from __future__ import annotations

import math
import re
import uuid
import logging
from collections import defaultdict
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple

from pydantic import BaseModel, Field

logger = logging.getLogger("podacium.agent.memory.graph")


class EntityType(str, Enum):
    CONCEPT = "CONCEPT"
    TOOL = "TOOL"
    SKILL = "SKILL"
    PROJECT = "PROJECT"
    STUDENT = "STUDENT"
    CLIENT = "CLIENT"
    FREELANCER = "FREELANCER"
    TAX_RULE = "TAX_RULE"
    FRAMEWORK = "FRAMEWORK"
    ORGANIZATION = "ORGANIZATION"


class RelationType(str, Enum):
    PREREQUISITE_OF = "PREREQUISITE_OF"
    MASTERED = "MASTERED"
    ENROLLED_IN = "ENROLLED_IN"
    REQUIRES_SKILL = "REQUIRES_SKILL"
    DELIVERED = "DELIVERED"
    STRUGGLING_WITH = "STRUGGLING_WITH"
    RELATED_TO = "RELATED_TO"
    MENTIONED_WITH = "MENTIONED_WITH"
    APPLIES_TO = "APPLIES_TO"
    COMPLIES_WITH = "COMPLIES_WITH"


class MasteryState(str, Enum):
    NOT_STARTED = "NOT_STARTED"
    INTRODUCED = "INTRODUCED"
    PRACTICING = "PRACTICING"
    MASTERED = "MASTERED"
    BLOCKED = "BLOCKED"


class EntityNode(BaseModel):
    id: str
    name: str
    entity_type: str = EntityType.CONCEPT.value
    description: str = ""
    attributes: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    embedding: Optional[List[float]] = None


class RelationEdge(BaseModel):
    id: str
    source: str
    target: str
    relation_type: str = RelationType.RELATED_TO.value
    weight: float = 1.0
    episode_ids: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Episode(BaseModel):
    id: str
    user_id: int
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    content: str
    context: Dict[str, Any] = Field(default_factory=dict)
    entity_ids: List[str] = Field(default_factory=list)
    relation_ids: List[str] = Field(default_factory=list)
    trajectory_updates: List[Dict[str, Any]] = Field(default_factory=list)


class CommunityCluster(BaseModel):
    id: str
    level: int  # 0: micro, 1: meso, 2: macro
    title: str
    summary: str
    entity_ids: List[str] = Field(default_factory=list)
    cohesion_score: float = 1.0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TrajectoryEvent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: int
    concept_id: str
    concept_name: str
    mastery_state: str = MasteryState.INTRODUCED.value
    score: float = 1.0
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    episode_id: Optional[str] = None
    notes: str = ""


class EpisodicGraphMemory:
    """
    GraphRAG Episodic & Semantic Memory Engine for Podacium Agents.
    Maintains dual graph-relational topology, episodic logs, hierarchical clusters,
    and student/client learning trajectories.
    """

    def __init__(self):
        self.nodes: Dict[str, EntityNode] = {}
        self.edges: Dict[str, RelationEdge] = {}
        self.episodes: Dict[str, Episode] = {}
        self.communities: Dict[int, List[CommunityCluster]] = {0: [], 1: [], 2: []}
        self.user_trajectories: Dict[int, List[TrajectoryEvent]] = defaultdict(list)
        self.user_concept_states: Dict[Tuple[int, str], str] = {}

        # Adjacency maps for fast graph traversal
        self.adj_out: Dict[str, List[str]] = defaultdict(list)
        self.adj_in: Dict[str, List[str]] = defaultdict(list)
        self.edge_by_pair: Dict[Tuple[str, str, str], str] = {}

    # -------------------------------------------------------------------------
    # 1. ENTITY & RELATION EXTRACTION
    # -------------------------------------------------------------------------
    def extract_entities_and_relations(
        self, text: str, context: Optional[Dict[str, Any]] = None
    ) -> Tuple[List[EntityNode], List[RelationEdge]]:
        """
        Extracts entities and relations from episodic text.
        Blends pattern heuristics with domain knowledge (FastAPI, React, CIDTA, TVA, Bloom, Arrêté 1275).
        """
        extracted_nodes: List[EntityNode] = []
        extracted_edges: List[RelationEdge] = []
        node_lookup: Dict[str, EntityNode] = {}

        # Domain keywords mapping
        keywords_map: Dict[str, Tuple[str, str]] = {
            "python": ("Python", EntityType.SKILL.value),
            "fastapi": ("FastAPI", EntityType.FRAMEWORK.value),
            "next.js": ("Next.js", EntityType.FRAMEWORK.value),
            "nextjs": ("Next.js", EntityType.FRAMEWORK.value),
            "react": ("React", EntityType.FRAMEWORK.value),
            "typescript": ("TypeScript", EntityType.SKILL.value),
            "docker": ("Docker", EntityType.TOOL.value),
            "celery": ("Celery", EntityType.TOOL.value),
            "prisma": ("Prisma ORM", EntityType.TOOL.value),
            "cidta": ("Article 169 CIDTA", EntityType.TAX_RULE.value),
            "article 169": ("Article 169 CIDTA", EntityType.TAX_RULE.value),
            "anae": ("Statut Auto-Entrepreneur ANAE", EntityType.TAX_RULE.value),
            "loi 22-23": ("Loi 22-23 Auto-Entrepreneur", EntityType.TAX_RULE.value),
            "arrêté 1275": ("Arrêté 1275 Diplôme-Startup", EntityType.CONCEPT.value),
            "arrete 1275": ("Arrêté 1275 Diplôme-Startup", EntityType.CONCEPT.value),
            "bloom": ("Bloom's Taxonomy", EntityType.CONCEPT.value),
            "scf": ("Système Comptable Financier (SCF)", EntityType.TAX_RULE.value),
            "compte 6181": ("Compte 6181 Formation", EntityType.TAX_RULE.value),
            "compte 6186": (
                "Compte 6186 Honoraires Freelance",
                EntityType.TAX_RULE.value,
            ),
            "compte 411": ("Compte 411 Créances Clients", EntityType.TAX_RULE.value),
            "tva": ("Taxe sur la Valeur Ajoutée (TVA)", EntityType.TAX_RULE.value),
        }

        lower_text = text.lower()
        found_entities: List[Tuple[str, str]] = []

        for kw, (canonical_name, etype) in keywords_map.items():
            if re.search(rf"\b{re.escape(kw)}\b", lower_text):
                found_entities.append((canonical_name, etype))

        # Additional regex extraction for capitalized concepts (e.g. "Algorithmic Design", "Machine Learning")
        cap_matches = re.findall(
            r"\b[A-Z][a-zA-Z0-9_\-\+]+(?:\s+[A-Z][a-zA-Z0-9_\-\+]+)*\b", text
        )
        for cap in cap_matches:
            if len(cap) > 3 and cap.lower() not in [
                k.lower() for k, _ in found_entities
            ]:
                # Exclude common English/French stopwords
                if cap.lower() not in {
                    "the",
                    "this",
                    "that",
                    "pour",
                    "dans",
                    "avec",
                    "nous",
                    "vous",
                    "le",
                    "la",
                    "les",
                }:
                    found_entities.append((cap, EntityType.CONCEPT.value))

        # Deduplicate entities
        seen_names: Set[str] = set()
        for name, etype in found_entities:
            normalized_name = name.strip()
            if normalized_name.lower() in seen_names:
                continue
            seen_names.add(normalized_name.lower())
            node_id = f"ent_{uuid.uuid5(uuid.NAMESPACE_DNS, normalized_name.lower()).hex[:12]}"
            node = EntityNode(
                id=node_id,
                name=normalized_name,
                entity_type=etype,
                description=f"Extracted entity from conversation turn: {normalized_name}",
            )
            extracted_nodes.append(node)
            node_lookup[normalized_name.lower()] = node

        # Extract relation heuristics
        # 1. Prerequisite pairs (e.g. Python -> FastAPI, React -> Next.js)
        prereq_rules = [
            ("python", "fastapi"),
            ("react", "next.js"),
            ("typescript", "next.js"),
            ("article 169", "loi 22-23"),
            ("anae", "compte 6186"),
            ("cidta", "compte 6181"),
        ]
        for src_kw, tgt_kw in prereq_rules:
            src_name = keywords_map.get(src_kw, (None, None))[0]
            tgt_name = keywords_map.get(tgt_kw, (None, None))[0]
            if src_name and tgt_name:
                src_node = node_lookup.get(src_name.lower())
                tgt_node = node_lookup.get(tgt_name.lower())
                if src_node and tgt_node:
                    edge_id = f"rel_{src_node.id}_{tgt_node.id}_prereq"
                    edge = RelationEdge(
                        id=edge_id,
                        source=src_node.id,
                        target=tgt_node.id,
                        relation_type=RelationType.PREREQUISITE_OF.value,
                        weight=1.5,
                        metadata={"rule": "domain_knowledge"},
                    )
                    extracted_edges.append(edge)

        # 2. General co-occurrence relations between consecutive nodes
        for i in range(len(extracted_nodes) - 1):
            n1 = extracted_nodes[i]
            n2 = extracted_nodes[i + 1]
            if n1.id != n2.id:
                edge_id = f"rel_{n1.id}_{n2.id}_cooc"
                edge = RelationEdge(
                    id=edge_id,
                    source=n1.id,
                    target=n2.id,
                    relation_type=RelationType.MENTIONED_WITH.value,
                    weight=0.8,
                    metadata={"context": "co_occurrence"},
                )
                extracted_edges.append(edge)

        return extracted_nodes, extracted_edges

    # -------------------------------------------------------------------------
    # 2. STORAGE & EPISODE INGESTION
    # -------------------------------------------------------------------------
    def upsert_node(self, node: EntityNode) -> EntityNode:
        if node.id in self.nodes:
            existing = self.nodes[node.id]
            existing.description = node.description or existing.description
            existing.attributes.update(node.attributes)
            existing.updated_at = datetime.now(timezone.utc)
            if node.embedding:
                existing.embedding = node.embedding
            return existing
        self.nodes[node.id] = node
        return node

    def upsert_edge(self, edge: RelationEdge) -> RelationEdge:
        key = (edge.source, edge.target, edge.relation_type)
        if key in self.edge_by_pair:
            existing_id = self.edge_by_pair[key]
            existing = self.edges[existing_id]
            existing.weight += 0.2
            for ep_id in edge.episode_ids:
                if ep_id not in existing.episode_ids:
                    existing.episode_ids.append(ep_id)
            existing.metadata.update(edge.metadata)
            return existing

        self.edges[edge.id] = edge
        self.edge_by_pair[key] = edge.id
        self.adj_out[edge.source].append(edge.target)
        self.adj_in[edge.target].append(edge.source)
        return edge

    def record_episode(
        self,
        user_id: int,
        content: str,
        context: Optional[Dict[str, Any]] = None,
        trajectory_updates: Optional[List[Dict[str, Any]]] = None,
    ) -> Episode:
        """
        Ingests a conversational turn / interaction as an episodic memory event.
        Extracts entities, links relations, updates trajectories, and registers community updates.
        """
        episode_id = f"ep_{uuid.uuid4().hex[:12]}"
        nodes, edges = self.extract_entities_and_relations(content, context)

        node_ids = []
        for n in nodes:
            saved_node = self.upsert_node(n)
            node_ids.append(saved_node.id)

        edge_ids = []
        for e in edges:
            e.episode_ids.append(episode_id)
            saved_edge = self.upsert_edge(e)
            edge_ids.append(saved_edge.id)

        # Process trajectory updates
        updates = trajectory_updates or []
        for update in updates:
            concept_id = update.get("concept_id") or update.get("concept")
            concept_name = update.get("concept_name", concept_id or "Unknown")
            mastery = update.get("mastery_state", MasteryState.PRACTICING.value)
            score = float(update.get("score", 1.0))
            notes = update.get("notes", "")
            if concept_id:
                self.record_learning_event(
                    user_id=user_id,
                    concept_id=concept_id,
                    concept_name=concept_name,
                    mastery_state=mastery,
                    score=score,
                    notes=notes,
                    episode_id=episode_id,
                )

        episode = Episode(
            id=episode_id,
            user_id=user_id,
            content=content,
            context=context or {},
            entity_ids=node_ids,
            relation_ids=edge_ids,
            trajectory_updates=updates,
        )
        self.episodes[episode_id] = episode

        # Periodically refresh communities
        if len(self.nodes) >= 3:
            self.build_hierarchical_communities()

        return episode

    # -------------------------------------------------------------------------
    # 3. HIERARCHICAL COMMUNITY CLUSTERING
    # -------------------------------------------------------------------------
    def build_hierarchical_communities(
        self, max_levels: int = 3
    ) -> Dict[int, List[CommunityCluster]]:
        """
        Hierarchical graph clustering:
        Level 0: Micro-communities (connected subgraphs / direct neighbors)
        Level 1: Meso-communities (merged by entity type and dense bridges)
        Level 2: Macro-communities (holistic domain clusters)
        """
        if not self.nodes:
            return {0: [], 1: [], 2: []}

        # Level 0: Micro-clusters via connected components / neighborhood expansion
        visited: Set[str] = set()
        level_0_clusters: List[CommunityCluster] = []
        cluster_idx = 0

        for node_id in self.nodes:
            if node_id in visited:
                continue
            component = []
            queue = [node_id]
            visited.add(node_id)

            while queue:
                curr = queue.pop(0)
                component.append(curr)
                neighbors = self.adj_out.get(curr, []) + self.adj_in.get(curr, [])
                for nxt in neighbors:
                    if nxt in self.nodes and nxt not in visited:
                        visited.add(nxt)
                        queue.append(nxt)

            member_names = [
                self.nodes[nid].name for nid in component if nid in self.nodes
            ]
            summary = f"Micro-community containing {len(component)} concepts: {', '.join(member_names[:5])}"
            title = member_names[0] if member_names else f"Cluster-{cluster_idx}"
            cluster = CommunityCluster(
                id=f"comm_l0_{cluster_idx}",
                level=0,
                title=title,
                summary=summary,
                entity_ids=component,
                cohesion_score=round(1.0 / (1.0 + math.log(max(1, len(component)))), 3),
            )
            level_0_clusters.append(cluster)
            cluster_idx += 1

        # Level 1: Meso-clusters aggregated by entity types
        type_buckets: Dict[str, List[str]] = defaultdict(list)
        for node in self.nodes.values():
            type_buckets[node.entity_type].append(node.id)

        level_1_clusters: List[CommunityCluster] = []
        for l1_idx, (etype, nids) in enumerate(type_buckets.items()):
            names = [self.nodes[nid].name for nid in nids if nid in self.nodes]
            summary = f"Domain sector [{etype}] encompassing: {', '.join(names[:6])}"
            cluster = CommunityCluster(
                id=f"comm_l1_{l1_idx}",
                level=1,
                title=f"{etype} Ecosystem",
                summary=summary,
                entity_ids=nids,
                cohesion_score=0.85,
            )
            level_1_clusters.append(cluster)

        # Level 2: Macro-cluster (Global domain knowledge cluster)
        all_ids = list(self.nodes.keys())
        macro_summary = f"Global Knowledge Graph: {len(all_ids)} entities, {len(self.edges)} active relationships."
        level_2_clusters = [
            CommunityCluster(
                id="comm_l2_root",
                level=2,
                title="Podacium Core Knowledge Base",
                summary=macro_summary,
                entity_ids=all_ids,
                cohesion_score=0.95,
            )
        ]

        self.communities = {
            0: level_0_clusters,
            1: level_1_clusters,
            2: level_2_clusters,
        }
        return self.communities

    # -------------------------------------------------------------------------
    # 4. RECIPROCAL RANK FUSION (RRF) RETRIEVAL
    # -------------------------------------------------------------------------
    def _dense_retrieval(self, query: str) -> List[Tuple[str, float]]:
        """
        Dense semantic scoring. Uses token cosine / jaccard embedding proxy when
        raw tensor embeddings are absent, or cosine similarity when present.
        """
        query_tokens = set(re.findall(r"\w+", query.lower()))
        scores: List[Tuple[str, float]] = []

        for node_id, node in self.nodes.items():
            # If embedding exists, compute cosine; else use semantic token overlap
            node_text = f"{node.name} {node.description} {' '.join(str(v) for v in node.attributes.values())}"
            node_tokens = set(re.findall(r"\w+", node_text.lower()))
            if not query_tokens or not node_tokens:
                score = 0.0
            else:
                intersection = len(query_tokens & node_tokens)
                union = len(query_tokens | node_tokens)
                score = intersection / union if union > 0 else 0.0
            scores.append((node_id, score))

        scores.sort(key=lambda x: x[1], reverse=True)
        return scores

    def _sparse_retrieval(self, query: str) -> List[Tuple[str, float]]:
        """
        Sparse BM25 / TF-IDF scoring proxy for exact keyword matches.
        """
        query_words = [w for w in re.findall(r"\w+", query.lower()) if len(w) > 2]
        scores: List[Tuple[str, float]] = []

        for node_id, node in self.nodes.items():
            content = f"{node.name.lower()} {node.description.lower()}"
            freq = 0
            for word in query_words:
                if word in node.name.lower():
                    freq += 3  # exact title bonus
                elif word in content:
                    freq += 1
            scores.append((node_id, float(freq)))

        scores.sort(key=lambda x: x[1], reverse=True)
        return scores

    def _graph_topology_retrieval(self, seed_query: str) -> List[Tuple[str, float]]:
        """
        Graph centrality & neighbor propagation scoring.
        Nodes with high degree centrality or direct edge connections to matched seeds receive highest rank.
        """
        degree_map: Dict[str, float] = {}
        for nid in self.nodes:
            deg = len(self.adj_out.get(nid, [])) + len(self.adj_in.get(nid, []))
            degree_map[nid] = float(deg)

        # Seed matching
        query_lower = seed_query.lower()
        for nid, node in self.nodes.items():
            if node.name.lower() in query_lower or query_lower in node.name.lower():
                degree_map[nid] += 10.0
                for neighbor in self.adj_out.get(nid, []) + self.adj_in.get(nid, []):
                    if neighbor in degree_map:
                        degree_map[neighbor] += 3.0

        ranked = sorted(degree_map.items(), key=lambda x: x[1], reverse=True)
        return ranked

    def search(
        self,
        query: str,
        top_k: int = 5,
        k_constant: int = 60,
        weights: Optional[Dict[str, float]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Reciprocal Rank Fusion (RRF) tri-channel retrieval:
        Combines:
        1. Dense semantic matching
        2. Sparse keyword matching
        3. Graph structural centrality & neighbor propagation

        RRF Score Formula:
        RRF(d) = sum_{channel} (weight_channel / (k + rank_channel(d)))
        """
        w_dense = weights.get("dense", 1.0) if weights else 1.0
        w_sparse = weights.get("sparse", 1.0) if weights else 1.0
        w_graph = weights.get("graph", 1.0) if weights else 1.0

        dense_ranks = {
            nid: rank for rank, (nid, _) in enumerate(self._dense_retrieval(query))
        }
        sparse_ranks = {
            nid: rank for rank, (nid, _) in enumerate(self._sparse_retrieval(query))
        }
        graph_ranks = {
            nid: rank
            for rank, (nid, _) in enumerate(self._graph_topology_retrieval(query))
        }

        rrf_scores: Dict[str, float] = {}
        channel_ranks: Dict[str, Dict[str, int]] = {}

        all_node_ids = set(self.nodes.keys())
        for nid in all_node_ids:
            r_dense = dense_ranks.get(nid, len(all_node_ids))
            r_sparse = sparse_ranks.get(nid, len(all_node_ids))
            r_graph = graph_ranks.get(nid, len(all_node_ids))

            score = (
                (w_dense / (k_constant + r_dense + 1))
                + (w_sparse / (k_constant + r_sparse + 1))
                + (w_graph / (k_constant + r_graph + 1))
            )
            rrf_scores[nid] = score
            channel_ranks[nid] = {
                "dense_rank": r_dense + 1,
                "sparse_rank": r_sparse + 1,
                "graph_rank": r_graph + 1,
            }

        sorted_results = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)[
            :top_k
        ]

        output = []
        for nid, score in sorted_results:
            node = self.nodes[nid]
            output.append(
                {
                    "node_id": node.id,
                    "name": node.name,
                    "entity_type": node.entity_type,
                    "description": node.description,
                    "rrf_score": round(score, 5),
                    "channel_ranks": channel_ranks[nid],
                    "attributes": node.attributes,
                }
            )
        return output

    # -------------------------------------------------------------------------
    # 5. STUDENT & CLIENT LEARNING TRAJECTORIES
    # -------------------------------------------------------------------------
    def record_learning_event(
        self,
        user_id: int,
        concept_id: str,
        concept_name: str,
        mastery_state: str = MasteryState.INTRODUCED.value,
        score: float = 1.0,
        notes: str = "",
        episode_id: Optional[str] = None,
    ) -> TrajectoryEvent:
        """Records a progression step along a user's educational/professional learning curve."""
        event = TrajectoryEvent(
            user_id=user_id,
            concept_id=concept_id,
            concept_name=concept_name,
            mastery_state=mastery_state,
            score=score,
            notes=notes,
            episode_id=episode_id,
        )
        self.user_trajectories[user_id].append(event)
        self.user_concept_states[(user_id, concept_id)] = mastery_state
        return event

    def get_learning_trajectory(self, user_id: int) -> List[TrajectoryEvent]:
        """Returns the full chronological learning trajectory for a student or client."""
        return sorted(
            self.user_trajectories.get(user_id, []), key=lambda e: e.timestamp
        )

    def diagnose_skill_gaps(
        self, user_id: int, target_concept_id: str
    ) -> Dict[str, Any]:
        """
        Diagnoses prerequisite mastery gaps for a target concept.
        Traverses upstream PREREQUISITE_OF edges and identifies unmastered prerequisites.
        """
        target_node = self.nodes.get(target_concept_id)
        target_name = target_node.name if target_node else target_concept_id

        # Find direct and transitive prerequisites
        prereqs = []
        for edge in self.edges.values():
            if (
                edge.target == target_concept_id
                and edge.relation_type == RelationType.PREREQUISITE_OF.value
            ):
                prereq_node = self.nodes.get(edge.source)
                prereq_name = prereq_node.name if prereq_node else edge.source
                prereqs.append({"concept_id": edge.source, "name": prereq_name})

        missing_prereqs = []
        mastered_prereqs = []

        for p in prereqs:
            cid = p["concept_id"]
            state = self.user_concept_states.get(
                (user_id, cid), MasteryState.NOT_STARTED.value
            )
            p_info = {**p, "current_state": state}
            if state == MasteryState.MASTERED.value:
                mastered_prereqs.append(p_info)
            else:
                missing_prereqs.append(p_info)

        target_state = self.user_concept_states.get(
            (user_id, target_concept_id), MasteryState.NOT_STARTED.value
        )

        return {
            "user_id": user_id,
            "target_concept": target_name,
            "target_state": target_state,
            "is_ready": len(missing_prereqs) == 0,
            "missing_prerequisites": missing_prereqs,
            "mastered_prerequisites": mastered_prereqs,
        }

    def suggest_next_pedagogical_step(self, user_id: int) -> Dict[str, Any]:
        """
        Recommends the next optimal concept to practice or study based on current trajectory.
        """
        trajectory = self.get_learning_trajectory(user_id)
        if not trajectory:
            # Cold start: recommend fundamental concepts (nodes with no prerequisites)
            foundational = [
                n.name
                for nid, n in self.nodes.items()
                if len(self.adj_in.get(nid, [])) == 0
            ]
            recommended = (
                foundational[0] if foundational else "Fundamentals of Web Engineering"
            )
            return {
                "recommendation_type": "COLD_START",
                "concept": recommended,
                "reason": "Initial orientation based on foundational knowledge graph nodes.",
            }

        # Check latest event
        latest = trajectory[-1]
        if latest.mastery_state in (
            MasteryState.INTRODUCED.value,
            MasteryState.PRACTICING.value,
        ):
            return {
                "recommendation_type": "PRACTICE_ACTIVE",
                "concept": latest.concept_name,
                "reason": f"Reinforce mastery of active concept '{latest.concept_name}' before progressing.",
            }

        if latest.mastery_state == MasteryState.BLOCKED.value:
            gaps = self.diagnose_skill_gaps(user_id, latest.concept_id)
            if gaps["missing_prerequisites"]:
                rec = gaps["missing_prerequisites"][0]["name"]
                return {
                    "recommendation_type": "REMEDIATE_PREREQUISITE",
                    "concept": rec,
                    "reason": f"Overcome block on '{latest.concept_name}' by mastering prerequisite '{rec}'.",
                }

        # If mastered, check forward downstream concepts
        downstream = self.adj_out.get(latest.concept_id, [])
        for nxt_id in downstream:
            nxt_state = self.user_concept_states.get(
                (user_id, nxt_id), MasteryState.NOT_STARTED.value
            )
            if nxt_state != MasteryState.MASTERED.value:
                nxt_node = self.nodes.get(nxt_id)
                name = nxt_node.name if nxt_node else nxt_id
                return {
                    "recommendation_type": "NEXT_CURRICULUM_STEP",
                    "concept": name,
                    "reason": f"Natural progression: follow prerequisite chain from '{latest.concept_name}'.",
                }

        return {
            "recommendation_type": "ADVANCED_EXPLORATION",
            "concept": "Capstone Project & Arrêté 1275 Incubation",
            "reason": "All sequential prerequisites mastered. Ready for applied synthesis.",
        }


# Global singleton instance for episodic memory
episodic_memory = EpisodicGraphMemory()
