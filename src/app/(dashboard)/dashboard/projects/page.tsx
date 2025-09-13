"use client";

import { RedirectToSignIn, SignedIn } from "@daveyplate/better-auth-ui";
import {
  Loader2,
  Search,
  Grid3X3,
  List,
  Calendar,
  Image as ImageIcon,
  MoreVertical,
  Edit,
  Trash2,
  Download,
  Eye,
  Plus,
} from "lucide-react";
import { authClient } from "~/lib/auth-client";
import { useEffect, useState } from "react";
import { getUserProjects } from "~/actions/projects";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useRouter } from "next/navigation";
import { Image as ImageKitImage } from "@imagekit/next";
import { env } from "~/env";

interface Project {
  id: string;
  name: string | null;
  imageUrl: string;
  imageKitId: string;
  filePath: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

type ViewMode = "grid" | "list";
type SortBy = "newest" | "oldest" | "name";

export default function ProjectsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [userProjects, setUserProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<SortBy>("newest");
  const router = useRouter();

  useEffect(() => {
    const initializeProjects = async () => {
      try {
        await authClient.getSession();

        // Fetch user projects
        const projectsResult = await getUserProjects();
        if (projectsResult.success && projectsResult.projects) {
          setUserProjects(projectsResult.projects);
          setFilteredProjects(projectsResult.projects);
        }
      } catch (error) {
        console.error("Projects initialization failed:", error);
      } finally {
        setIsLoading(false);
      }
    };

    void initializeProjects();
  }, []);

  // Filter and sort projects
  useEffect(() => {
    let filtered = userProjects.filter((project) =>
      (project.name ?? "Untitled Project")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()),
    );

    // Sort projects
    switch (sortBy) {
      case "newest":
        filtered = filtered.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        break;
      case "oldest":
        filtered = filtered.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        break;
      case "name":
        filtered = filtered.sort((a, b) =>
          (a.name ?? "Untitled Project").localeCompare(
            b.name ?? "Untitled Project",
          ),
        );
        break;
    }

    setFilteredProjects(filtered);
  }, [userProjects, searchQuery, sortBy]);

  const handleProjectClick = (_project: Project) => {
    // Navigate to create page with project data - you can extend this to load the project
    router.push("/dashboard/create");
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
          <p className="text-muted-foreground text-sm">
            Loading your projects...
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <RedirectToSignIn />
      <SignedIn>
        <div className="space-y-6">
          {/* Header Section */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <h1 className="from-primary to-primary/70 bg-gradient-to-r bg-clip-text text-2xl font-bold tracking-tight text-transparent sm:text-3xl">
                Your Projects
              </h1>
              <p className="text-muted-foreground text-base">
                Manage and organize all your AI-generated images (
                {filteredProjects.length}{" "}
                {filteredProjects.length === 1 ? "project" : "projects"})
              </p>
            </div>
            <Button
              onClick={() => router.push("/dashboard/create")}
              className="gap-2 self-start sm:self-auto"
            >
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </div>

          {/* Controls Bar */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                {/* Search */}
                <div className="relative max-w-md flex-1">
                  <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                  <Input
                    placeholder="Search projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <div className="flex items-center gap-2">
                  {/* Sort Dropdown */}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortBy)}
                    className="border-input bg-background rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="name">Name A-Z</option>
                  </select>

                  {/* View Mode Toggle */}
                  <div className="border-input flex rounded-md border">
                    <Button
                      variant={viewMode === "grid" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("grid")}
                      className="rounded-r-none"
                    >
                      <Grid3X3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === "list" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setViewMode("list")}
                      className="rounded-l-none"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Projects Content */}
          {filteredProjects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="relative mb-6">
                  <div className="border-muted bg-muted/20 flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed">
                    <ImageIcon className="text-muted-foreground h-10 w-10" />
                  </div>
                </div>
                <h3 className="mb-2 text-xl font-semibold">
                  {searchQuery ? "No projects found" : "No projects yet"}
                </h3>
                <p className="text-muted-foreground mb-6 max-w-md text-sm">
                  {searchQuery
                    ? `No projects match "${searchQuery}". Try adjusting your search terms.`
                    : "Start creating amazing images with AI tools to see them here."}
                </p>
                {!searchQuery && (
                  <Button
                    onClick={() => router.push("/dashboard/create")}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Create Your First Project
                  </Button>
                )}
                {searchQuery && (
                  <Button
                    variant="outline"
                    onClick={() => setSearchQuery("")}
                    className="gap-2"
                  >
                    Clear Search
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div
              className={
                viewMode === "grid"
                  ? "grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                  : "space-y-4"
              }
            >
              {filteredProjects.map((project) =>
                viewMode === "grid" ? (
                  <Card
                    key={project.id}
                    className="group cursor-pointer overflow-hidden transition-all hover:shadow-lg"
                    onClick={() => handleProjectClick(project)}
                  >
                    <div className="relative aspect-square overflow-hidden">
                      <ImageKitImage
                        urlEndpoint={env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT}
                        src={project.filePath}
                        alt={project.name ?? "Project"}
                        width={300}
                        height={300}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        transformation={[
                          {
                            width: 300,
                            height: 300,
                            crop: "maintain_ratio",
                            quality: 85,
                          },
                        ]}
                      />
                    </div>
                    <CardContent className="p-3">
                      <h3 className="truncate text-sm font-medium">
                        {project.name ?? "Untitled Project"}
                      </h3>
                      <div className="mt-1 flex items-center justify-between">
                        <p className="text-muted-foreground text-xs">
                          {new Date(project.createdAt).toLocaleDateString()}
                        </p>
                        <div className="opacity-0 transition-opacity group-hover:opacity-100">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                          >
                            <MoreVertical className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card
                    key={project.id}
                    className="group cursor-pointer transition-all hover:shadow-md"
                    onClick={() => handleProjectClick(project)}
                  >
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="h-16 w-16 overflow-hidden rounded-lg border">
                        <ImageKitImage
                          urlEndpoint={env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT}
                          src={project.filePath}
                          alt={project.name ?? "Project"}
                          width={64}
                          height={64}
                          className="h-full w-full object-cover"
                          transformation={[
                            {
                              width: 64,
                              height: 64,
                              crop: "maintain_ratio",
                              quality: 85,
                            },
                          ]}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-medium">
                          {project.name ?? "Untitled Project"}
                        </h3>
                        <div className="text-muted-foreground mt-1 flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(project.createdAt).toLocaleDateString()}
                          </div>
                          <div className="flex items-center gap-1">
                            <ImageIcon className="h-3 w-3" />
                            Image
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ),
              )}
            </div>
          )}

          {/* Load More Button - if you want to implement pagination */}
          {filteredProjects.length >= 20 && (
            <div className="text-center">
              <Button variant="outline" className="gap-2">
                Load More Projects
                <Loader2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </SignedIn>
    </>
  );
}