'use client';

import * as React from 'react';
import { api, Project, ApiClientError } from '@/lib/api';

// Project context state
interface ProjectState {
  projects: Project[];
  activeProject: Project | null;
  isLoading: boolean;
  error: string | null;
}

// Project context actions
interface ProjectActions {
  setActiveProject: (project: Project) => void;
  refreshProjects: () => Promise<void>;
  createProject: (data: { name: string; slug?: string; description?: string; color?: string }) => Promise<Project>;
  updateProject: (id: string, data: { name?: string; slug?: string; description?: string; color?: string }) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
}

// Combined context type
type ProjectContextType = ProjectState & ProjectActions;

// Create context
const ProjectContext = React.createContext<ProjectContextType | undefined>(undefined);

// Storage key for active project
const ACTIVE_PROJECT_KEY = 'saveaction_active_project_id';

// Provider props
interface ProjectProviderProps {
  children: React.ReactNode;
}

/**
 * Project Provider Component
 *
 * Manages project state and provides project methods to children.
 * Persists active project selection to localStorage.
 */
export function ProjectProvider({ children }: ProjectProviderProps) {
  const [state, setState] = React.useState<ProjectState>({
    projects: [],
    activeProject: null,
    isLoading: true,
    error: null,
  });

  // Load projects on mount
  const loadProjects = React.useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      const response = await api.listProjects({ limit: 100 });
      const projects = response.data;

      // Get saved active project ID from localStorage
      let activeProjectId: string | null = null;
      if (typeof window !== 'undefined') {
        activeProjectId = localStorage.getItem(ACTIVE_PROJECT_KEY);
      }

      // Find active project or use default
      let activeProject = projects.find((p) => p.id === activeProjectId);
      if (!activeProject) {
        // Try to find the default project
        activeProject = projects.find((p) => p.isDefault);
      }
      if (!activeProject && projects.length > 0) {
        // Fall back to first project
        activeProject = projects[0];
      }

      setState({
        projects,
        activeProject: activeProject || null,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error('Failed to load projects:', error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof ApiClientError ? error.message : 'Failed to load projects',
      }));
    }
  }, []);

  // Load projects on mount and when API client has token
  React.useEffect(() => {
    // Only load if authenticated
    if (api.isAuthenticated()) {
      loadProjects();
    }
  }, [loadProjects]);

  // Set active project
  const setActiveProject = React.useCallback((project: Project) => {
    setState((prev) => ({ ...prev, activeProject: project }));
    if (typeof window !== 'undefined') {
      localStorage.setItem(ACTIVE_PROJECT_KEY, project.id);
    }
  }, []);

  // Refresh projects
  const refreshProjects = React.useCallback(async () => {
    await loadProjects();
  }, [loadProjects]);

  // Create project
  const createProject = React.useCallback(
    async (data: { name: string; slug?: string; description?: string; color?: string }): Promise<Project> => {
      const project = await api.createProject(data);
      setState((prev) => ({
        ...prev,
        projects: [...prev.projects, project],
      }));
      return project;
    },
    []
  );

  // Update project
  const updateProject = React.useCallback(
    async (
      id: string,
      data: { name?: string; slug?: string; description?: string; color?: string }
    ): Promise<Project> => {
      const updated = await api.updateProject(id, data);
      setState((prev) => ({
        ...prev,
        projects: prev.projects.map((p) => (p.id === id ? updated : p)),
        activeProject: prev.activeProject?.id === id ? updated : prev.activeProject,
      }));
      return updated;
    },
    []
  );

  // Delete project
  const deleteProject = React.useCallback(async (id: string): Promise<void> => {
    await api.deleteProject(id);
    setState((prev) => {
      const newProjects = prev.projects.filter((p) => p.id !== id);
      // If we deleted the active project, switch to default or first
      let newActiveProject = prev.activeProject;
      if (prev.activeProject?.id === id) {
        newActiveProject = newProjects.find((p) => p.isDefault) || newProjects[0] || null;
        if (newActiveProject && typeof window !== 'undefined') {
          localStorage.setItem(ACTIVE_PROJECT_KEY, newActiveProject.id);
        }
      }
      return {
        ...prev,
        projects: newProjects,
        activeProject: newActiveProject,
      };
    });
  }, []);

  // Context value
  const value: ProjectContextType = React.useMemo(
    () => ({
      ...state,
      setActiveProject,
      refreshProjects,
      createProject,
      updateProject,
      deleteProject,
    }),
    [state, setActiveProject, refreshProjects, createProject, updateProject, deleteProject]
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

/**
 * Hook to use project context
 */
export function useProjects(): ProjectContextType {
  const context = React.useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProjects must be used within a ProjectProvider');
  }
  return context;
}

/**
 * Hook to get active project only
 * Returns null if projects are loading or no project selected
 */
export function useActiveProject(): Project | null {
  const { activeProject } = useProjects();
  return activeProject;
}
