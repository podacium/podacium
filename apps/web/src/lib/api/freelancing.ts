/**
 * Freelancing Hub API module.
 * Handles projects, proposals, contracts, deliveries, freelancer profiles.
 */

import { apiClient } from "./client";
import {
  ProjectStatus,
  ProposalStatus,
  ContractStatus,
  DisputeReason,
  ContractCreate,
} from "./types";

// =============================================================================
// FREELANCING TYPES
// =============================================================================

export interface ProjectCreate {
  title: string;
  description?: string;
  skills: string[];
  budget_range_min?: number;
  budget_range_max?: number;
}

export interface ProjectResponse {
  id: number;
  title: string;
  description?: string;
  ownerId: number;
  skills: string[];
  status: string;
  createdAt: string;
  updatedAt?: string;
  updated_at?: string;
  featuredBoost?: number;
  featuredExpiresAt?: string | null;
  owner?: {
    id: number;
    fullName: string;
    profilePictureUrl?: string;
    country?: string;
    city?: string;
    phoneVerified?: boolean;
  };
  has_applied: boolean;
  is_owner: boolean;
}

export interface ProposalCreate {
  message: string;
  amount: number;
  estimated_days?: number;
}

export interface ProposalResponse {
  id: number;
  projectId: number;
  freelancerId?: number;
  message?: string;
  amount?: number;
  status: string;
  createdAt: string;
  freelancer?: {
    id: number;
    fullName: string;
    profilePictureUrl?: string;
    skills: string[];
    bio?: string;
    phoneVerified?: boolean;
    certificates?: any[];
  };
  project?: {
    id: number;
    title: string;
    owner?: {
      id: number;
      fullName: string;
      profilePictureUrl?: string;
      country?: string;
      city?: string;
    };
  };
}

export interface ContractResponse {
  id: number;
  projectId: number;
  freelancerId?: number;
  clientId?: number;
  terms?: string;
  amount?: number;
  status: string;
  createdAt: string;
  project?: { id: number; title: string };
  freelancer?: { id: number; fullName: string; profilePictureUrl?: string };
  client?: { id: number; fullName: string; profilePictureUrl?: string };
  deliveries?: DeliveryResponse[];
  user_role?: "freelancer" | "client";
  startDate?: string;
  endDate?: string;
  milestones?: {
    id: number;
    title?: string;
    amount?: number;
    status?: string;
  }[];
}

export interface DeliveryCreate {
  description: string;
  file_urls?: string[];
}

export interface DeliveryResponse {
  id: number;
  contractId: number;
  description?: string;
  deliveredAt: string;
  files?: any;
}

export interface FreelancerProfileResponse {
  id: number;
  full_name: string;
  fullName?: string;
  bio?: string;
  profile_picture_url?: string;
  profilePictureUrl?: string;
  skills: string[];
  city?: string;
  country?: string;
  phone_verified: boolean;
  phoneVerified?: boolean;
  skillPassportVerified?: boolean;
  role?: string;
  certificates_count: number;
  completed_projects: number;
  total_earnings: number;
  trust_score: number;
  avg_rating?: number;
  hourly_rate?: number;
  certificates?: any[];
  skills_details?: any[];
  completed_contracts?: any[];
  accepted_proposals?: number;
  recent_projects?: any[];
  receivedReviews?: any[];
}

export type PublicFreelancerResponse = FreelancerProfileResponse;

export interface FreelancerSearchResponse {
  freelancers: FreelancerProfileResponse[];
  total: number;
}

export type PublicFreelancerSearchResponse = FreelancerSearchResponse;

export interface PublicStatsResponse {
  total_freelancers?: number;
  completed_contracts?: number;
  [key: string]: any;
}

export interface FreelanceDashboardStats {
  is_freelancer: boolean;
  is_client: boolean;
  phone_verified: boolean;
  certificates_count: number;
  skills_count: number;
  freelancer?: {
    total_proposals: number;
    active_contracts: number;
    completed_contracts: number;
    total_earnings: number;
    pending_proposals?: number;
    accepted_proposals?: number;
  };
  client?: {
    total_projects: number;
    open_projects: number;
    active_contracts: number;
    total_spent: number;
    completed_projects?: number;
  };
}

export interface DisputeCreate {
  reason: DisputeReason;
  description: string;
}

// =============================================================================
// FREELANCING API METHODS
// =============================================================================

export const freelancingApi = {
  // Projects
  getProjects(params?: {
    skip?: number;
    limit?: number;
    skills?: string[];
    search?: string;
    status?: ProjectStatus;
  }) {
    const cleanParams = params
      ? Object.fromEntries(
          Object.entries(params).filter(
            ([_, v]) =>
              v !== undefined &&
              v !== null &&
              v !== "" &&
              v !== "undefined" &&
              v !== "null",
          ),
        )
      : {};
    const query = cleanParams
      ? "?" + new URLSearchParams(cleanParams as any).toString()
      : "";
    return apiClient.get<{ projects: ProjectResponse[]; total: number }>(
      `/api/hub/projects${query}`,
    );
  },

  getProject(id: number) {
    return apiClient.get<ProjectResponse>(`/api/hub/projects/${id}`);
  },

  createProject(data: ProjectCreate) {
    return apiClient.post<ProjectResponse>("/api/hub/projects", data);
  },

  updateProject(id: number, data: Partial<ProjectCreate>) {
    return apiClient.put<ProjectResponse>(`/api/hub/projects/${id}`, data);
  },

  deleteProject(id: number) {
    return apiClient.delete<void>(`/api/hub/projects/${id}`);
  },

  // Public projects
  getPublicProjects(params?: {
    skip?: number;
    limit?: number;
    search?: string;
  }) {
    const cleanParams = params
      ? Object.fromEntries(
          Object.entries(params).filter(
            ([_, v]) =>
              v !== undefined &&
              v !== null &&
              v !== "" &&
              v !== "undefined" &&
              v !== "null",
          ),
        )
      : {};
    const query = cleanParams
      ? "?" + new URLSearchParams(cleanParams as any).toString()
      : "";
    return apiClient.get<{ projects: ProjectResponse[]; total: number }>(
      `/api/hub/public/projects${query}`,
    );
  },

  // Proposals
  submitProposal(projectId: number, data: ProposalCreate) {
    return apiClient.post<ProposalResponse>(
      `/api/hub/projects/${projectId}/proposals`,
      data,
    );
  },

  getProjectProposals(projectId: number) {
    return apiClient.get<ProposalResponse[]>(
      `/api/hub/projects/${projectId}/proposals`,
    );
  },

  getMyProposals() {
    return apiClient.get<ProposalResponse[]>("/api/hub/proposals");
  },

  acceptProposal(proposalId: number, data?: ContractCreate) {
    return apiClient.post<ContractResponse>(
      `/api/hub/proposals/${proposalId}/accept`,
      data,
    );
  },

  rejectProposal(proposalId: number) {
    return apiClient.post<void>(`/api/hub/proposals/${proposalId}/reject`);
  },

  // Contracts
  getContracts(params?: {
    role?: string;
    status?: string;
    skip?: number;
    limit?: number;
  }) {
    const cleanParams = params
      ? Object.fromEntries(
          Object.entries(params).filter(
            ([_, v]) =>
              v !== undefined &&
              v !== null &&
              v !== "" &&
              v !== "undefined" &&
              v !== "null",
          ),
        )
      : {};
    const query = cleanParams
      ? "?" + new URLSearchParams(cleanParams as any).toString()
      : "";
    return apiClient.get<any>(`/api/hub/contracts${query}`);
  },

  getContract(id: number) {
    return apiClient.get<ContractResponse>(`/api/hub/contracts/${id}`);
  },

  deliverContract(contractId: number, data: DeliveryCreate) {
    return apiClient.post<DeliveryResponse>(
      `/api/hub/contracts/${contractId}/deliver`,
      data,
    );
  },

  completeContract(contractId: number) {
    return apiClient.post<ContractResponse>(
      `/api/hub/contracts/${contractId}/complete`,
    );
  },

  cancelContract(contractId: number) {
    return apiClient.post<ContractResponse>(
      `/api/hub/contracts/${contractId}/cancel`,
    );
  },

  // Disputes
  createDispute(contractId: number, data: DisputeCreate) {
    return apiClient.post<any>(
      `/api/hub/contracts/${contractId}/dispute`,
      data,
    );
  },

  // Freelancer profiles
  getFreelancers(params?: {
    skills?: string[];
    search?: string;
    skip?: number;
    limit?: number;
    min_budget?: number;
    max_budget?: number;
    category?: string;
    rating_min?: number;
  }) {
    const cleanParams = params
      ? Object.fromEntries(
          Object.entries(params).filter(
            ([_, v]) => v !== undefined && v !== "",
          ),
        )
      : {};
    const query = cleanParams
      ? "?" + new URLSearchParams(cleanParams as any).toString()
      : "";
    return apiClient.get<{
      freelancers: FreelancerProfileResponse[];
      total: number;
    }>(`/api/hub/freelancers${query}`);
  },

  getFreelancerProfile(id: number) {
    return apiClient.get<FreelancerProfileResponse>(
      `/api/hub/freelancers/${id}`,
    );
  },

  // Dashboard
  getDashboardStats() {
    return apiClient.get<FreelanceDashboardStats>("/api/hub/dashboard/stats");
  },

  getPublicStats() {
    return apiClient.get<PublicStatsResponse>("/api/hub/public/stats");
  },
};

export type PublicProjectResponse = ProjectResponse;
