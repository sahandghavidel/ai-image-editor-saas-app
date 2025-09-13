"use client";

import { RedirectToSignIn, SignedIn } from "@daveyplate/better-auth-ui";
import {
  Loader2,
  Upload,
  X,
  Image as ImageIcon,
  Scissors,
  Download,
  Expand,
  Target,
  RotateCcw,
  Minus,
} from "lucide-react";
import { authClient } from "~/lib/auth-client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { toast } from "sonner";
import { env } from "~/env";
import { upload, Image as ImageKitImage } from "@imagekit/next";
import {
  createProject,
  getUserProjects,
  deductCredits,
} from "~/actions/projects";

interface UploadedImage {
  fileId: string;
  url: string;
  name: string;
  filePath: string;
}

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

interface Transformation {
  aiRemoveBackground?: true;
  aiUpscale?: true;
  raw?: string;
}

interface UploadAuthResponse {
  signature: string;
  expire: number;
  token: string;
  publicKey: string;
}

export default function CreatePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(
    null,
  );
  const [transformations, setTransformations] = useState<Transformation[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [userProjects, setUserProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [objectInput, setObjectInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const initializeData = async () => {
      try {
        await authClient.getSession();

        // Fetch user projects
        const projectsResult = await getUserProjects();
        if (projectsResult.success && projectsResult.projects) {
          setUserProjects(projectsResult.projects);
        }
      } catch (error) {
        console.error("Initialization error:", error);
      } finally {
        setIsLoading(false);
        setIsLoadingProjects(false);
      }
    };

    void initializeData();
  }, []);

  const getUploadAuth = async (): Promise<UploadAuthResponse> => {
    const response = await fetch("/api/upload-auth");
    if (!response.ok) throw new Error("Auth failed");
    return response.json() as Promise<UploadAuthResponse>;
  };

  const selectFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
    setUploadedImage(null);
    setTransformations([]);
  };

  const uploadFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file?.type.startsWith("image/")) return;

    setIsUploading(true);
    try {
      const authParams = await getUploadAuth();
      const result = await upload({
        file,
        fileName: file.name,
        folder: "/ai-image-editor",
        ...authParams,
      });

      const uploadedData = {
        fileId: result.fileId ?? "",
        url: result.url ?? "",
        name: result.name ?? file.name,
        filePath: result.filePath ?? "",
      };

      setUploadedImage(uploadedData);

      // Save project to database using server action
      try {
        const projectResult = await createProject({
          imageUrl: uploadedData.url,
          imageKitId: uploadedData.fileId,
          filePath: uploadedData.filePath,
          name: uploadedData.name,
        });

        if (projectResult.success) {
          // Refresh projects list
          const updatedProjects = await getUserProjects();
          if (updatedProjects.success && updatedProjects.projects) {
            setUserProjects(updatedProjects.projects);
          }
        } else {
          console.error(
            "Failed to save project to database:",
            projectResult.error,
          );
        }
      } catch (dbError) {
        console.error("Database save error:", dbError);
      }

      toast.success("Upload successful!");
    } catch (error) {
      toast.error("Upload failed");
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  // Function to get live preview transformation
  const getLivePreviewTransformations = () => {
    return [...transformations];
  };

  // Helper functions to check if transformations exist
  const hasTransformation = (type: string) => {
    return transformations.some((transform: Transformation) => {
      if (type === "background" && transform.aiRemoveBackground) return true;
      if (type === "upscale" && transform.aiUpscale) return true;
      if (
        type === "objectCrop" &&
        transform.raw?.includes("fo-") &&
        transform.raw?.includes("ar-1-1")
      )
        return true;
      return false;
    });
  };

  // Function to remove specific transformation
  const removeTransformation = (type: string) => {
    setTransformations((prev) =>
      prev.filter((transform: Transformation) => {
        if (type === "background" && transform.aiRemoveBackground) return false;
        if (type === "upscale" && transform.aiUpscale) return false;
        if (
          type === "objectCrop" &&
          transform.raw?.includes("fo-") &&
          transform.raw?.includes("ar-1-1")
        )
          return false;
        return true;
      }),
    );
    toast.success(
      `${type.charAt(0).toUpperCase() + type.slice(1)} transformation removed!`,
    );
  };

  const removeBackground = async () => {
    if (!uploadedImage) return;

    // Check if background removal already applied
    if (hasTransformation("background")) {
      toast.error("Background removal is already applied!");
      return;
    }

    setIsProcessing(true);

    try {
      // Deduct credits first
      const creditResult = await deductCredits(2, "background removal");

      if (!creditResult.success) {
        toast.error(creditResult.error ?? "Failed to process payment");
        setIsProcessing(false);
        return;
      }

      // Apply background removal transformation
      setTransformations((prev) => [...prev, { aiRemoveBackground: true }]);

      setTimeout(() => {
        setIsProcessing(false);
        toast.success(
          `Background removed! ${creditResult.remainingCredits} credits remaining.`,
        );
        // Refresh to update sidebar credits display
        router.refresh();
      }, 3000);
    } catch (error) {
      console.error("Background removal error:", error);
      toast.error("Failed to remove background");
      setIsProcessing(false);
    }
  };

  const upscaleImage = async () => {
    if (!uploadedImage) return;

    // Check if upscale already applied
    if (hasTransformation("upscale")) {
      toast.error("Image upscaling is already applied!");
      return;
    }

    setIsProcessing(true);

    try {
      // Deduct credits first
      const creditResult = await deductCredits(1, "upscaling");

      if (!creditResult.success) {
        toast.error(creditResult.error ?? "Failed to process payment");
        setIsProcessing(false);
        return;
      }

      // Apply upscaling transformation
      setTransformations((prev) => [...prev, { aiUpscale: true }]);

      setTimeout(() => {
        setIsProcessing(false);
        toast.success(
          `Image upscaled! ${creditResult.remainingCredits} credits remaining.`,
        );
        // Refresh to update sidebar credits display
        router.refresh();
      }, 3000);
    } catch (error) {
      console.error("Upscaling error:", error);
      toast.error("Failed to upscale image");
      setIsProcessing(false);
    }
  };

  const objectCrop = async () => {
    if (!uploadedImage) return;

    // Check if object crop already applied
    if (hasTransformation("objectCrop")) {
      toast.error("Smart object crop is already applied!");
      return;
    }

    // Validate object input
    if (!objectInput.trim()) {
      toast.error("Please enter an object to focus on!");
      return;
    }

    setIsProcessing(true);

    try {
      // Apply smart object crop using the user's input with 1:1 aspect ratio
      const cleanInput = objectInput.trim().toLowerCase();
      const transformation = { raw: `fo-${cleanInput},ar-1-1` };

      setTransformations((prev) => [...prev, transformation]);

      setTimeout(() => {
        setIsProcessing(false);
        toast.success(`Smart crop applied focusing on "${objectInput}"!`);
      }, 3000);
    } catch (error) {
      console.error("Object crop error:", error);
      toast.error("Failed to apply smart crop");
      setIsProcessing(false);
    }
  };

  const clearTransformations = () => {
    setTransformations([]);
    toast.success("All transformations cleared!");
  };

  const downloadImage = () => {
    if (!uploadedImage) return;

    // Get the actual rendered image URL from the main preview
    const mainImage = document.querySelector('img[width="800"][height="600"]');
    const url =
      (mainImage as HTMLImageElement)?.src ??
      `${env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT}${uploadedImage.filePath}`;

    window.open(url, "_blank");
    toast.success("Download started!");
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <RedirectToSignIn />
      <SignedIn>
        <div className="min-h-screen">
          {/* Top Navbar - Ultra Compact */}
          <div className="border-b border-gray-200 bg-white py-2">
            <div className="mx-auto max-w-7xl text-center">
              <h1 className="from-primary to-primary/70 mb-1 bg-gradient-to-r bg-clip-text text-lg font-bold text-transparent">
                Create AI Images
              </h1>
              <p className="text-muted-foreground mx-auto max-w-xl text-xs">
                Upload and transform images with AI tools
              </p>
            </div>
          </div>

          {/* Main Content Area - Effects and Preview */}
          <div className="mx-auto max-w-7xl px-2 py-4 sm:px-4 sm:py-6">
            {!uploadedImage ? (
              <div className="flex min-h-[500px] items-center justify-center">
                <div className="w-full max-w-2xl">
                  {isUploading ? (
                    <div className="border-border from-muted/50 via-background to-muted/30 relative overflow-hidden rounded-2xl border bg-gradient-to-br p-6 text-center shadow-xl sm:p-12">
                      <div className="from-primary/5 to-primary/10 absolute inset-0 bg-gradient-to-br"></div>
                      <div className="relative z-10">
                        <div className="relative mb-6">
                          {/* Animated loading rings */}
                          <div className="border-muted border-t-primary mx-auto h-16 w-16 animate-spin rounded-full border-4"></div>
                          <div
                            className="border-r-primary/70 absolute inset-0 mx-auto h-16 w-16 animate-spin rounded-full border-4 border-transparent"
                            style={{
                              animationDelay: "0.5s",
                              animationDirection: "reverse",
                            }}
                          ></div>
                        </div>
                        <h3 className="text-foreground mb-2 text-lg font-bold">
                          Uploading your image
                        </h3>
                        <p className="text-muted-foreground text-sm">
                          Processing your file with AI magic ✨
                        </p>
                        <div className="bg-muted mx-auto mt-4 h-2 w-48 overflow-hidden rounded-full">
                          <div className="bg-primary h-full animate-pulse rounded-full"></div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="group border-border from-muted/30 via-background to-muted/50 hover:border-primary/50 hover:bg-muted/40 relative overflow-hidden rounded-2xl border-2 border-dashed bg-gradient-to-br p-6 text-center transition-all duration-300 hover:shadow-xl sm:p-12">
                      {/* Background decoration */}
                      <div className="from-primary/5 to-primary/10 absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>

                      {/* Floating icons background */}
                      <div className="absolute top-4 right-4 opacity-20 transition-opacity duration-300 group-hover:opacity-40">
                        <ImageIcon className="h-8 w-8 text-blue-400" />
                      </div>
                      <div className="absolute bottom-4 left-4 opacity-20 transition-opacity duration-300 group-hover:opacity-40">
                        <Upload className="h-6 w-6 text-purple-400" />
                      </div>

                      <div className="relative z-10">
                        {/* Main icon with gradient background */}
                        <div className="bg-primary mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:shadow-xl">
                          <ImageIcon className="text-primary-foreground h-12 w-12" />
                        </div>

                        {/* Content */}
                        <h3 className="text-foreground mb-3 text-xl font-bold">
                          Upload Your Image
                        </h3>

                        <p className="mx-auto mb-6 max-w-md text-sm leading-relaxed text-gray-600">
                          Click to browse and select your image. Transform it
                          with powerful AI tools.
                        </p>

                        {/* Supported formats */}
                        <div className="mb-6">
                          <p className="mb-2 text-xs text-gray-500">
                            Supported formats:
                          </p>
                          <div className="flex items-center justify-center gap-3">
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                              JPG
                            </span>
                            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                              PNG
                            </span>
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                              WEBP
                            </span>
                          </div>
                        </div>

                        {/* Call to action button */}
                        <Button
                          onClick={selectFile}
                          size="default"
                          className="bg-primary hover:bg-primary/90 text-primary-foreground transform gap-2 px-6 py-2 text-sm font-semibold shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl"
                        >
                          <Upload className="h-4 w-4" />
                          Choose Your Image
                        </Button>

                        <p className="mt-3 text-xs text-gray-500">
                          Select files from your device
                        </p>
                      </div>

                      {/* Hover effect border */}
                      <div className="bg-primary/10 absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={uploadFile}
                    className="hidden"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:gap-4 lg:grid-cols-3">
                {/* Left Side - Effects and Controls (1/3 width) - Order 2 on mobile */}
                <div className="order-2 space-y-2 sm:space-y-3 lg:order-1 lg:col-span-1">
                  <Card className="shadow-lg">
                    <CardContent className="p-2 sm:p-3">
                      <div className="mb-3 flex items-start justify-between">
                        <div>
                          <h3 className="mb-0.5 text-sm font-bold">
                            AI Effects
                          </h3>
                          <p className="text-muted-foreground text-xs">
                            Transform your image
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="grid gap-2 sm:grid-cols-1">
                          <div className="group relative">
                            <Button
                              onClick={removeBackground}
                              disabled={
                                isProcessing || hasTransformation("background")
                              }
                              variant="outline"
                              size="sm"
                              className="h-8 w-full gap-1 px-2 text-xs hover:border-red-200 hover:bg-red-50 disabled:opacity-50"
                            >
                              <Scissors className="h-3 w-3" />
                              <span className="text-xs">
                                {isProcessing
                                  ? "Processing..."
                                  : hasTransformation("background")
                                    ? "Removed ✓"
                                    : "Remove BG"}
                              </span>
                              {!hasTransformation("background") && (
                                <span className="text-muted-foreground ml-1 text-xs">
                                  (2 credits)
                                </span>
                              )}
                            </Button>
                            {hasTransformation("background") && (
                              <Button
                                onClick={() =>
                                  removeTransformation("background")
                                }
                                disabled={isProcessing}
                                variant="destructive"
                                size="sm"
                                className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full p-0 opacity-0 transition-opacity group-hover:opacity-100"
                              >
                                <Minus className="h-2 w-2" />
                              </Button>
                            )}
                          </div>

                          <div className="group relative">
                            <Button
                              onClick={upscaleImage}
                              disabled={
                                isProcessing || hasTransformation("upscale")
                              }
                              variant="outline"
                              size="sm"
                              className="h-8 w-full gap-1 px-2 text-xs hover:border-blue-200 hover:bg-blue-50 disabled:opacity-50"
                            >
                              <Expand className="h-3 w-3" />
                              <span className="text-xs">
                                {isProcessing
                                  ? "Processing..."
                                  : hasTransformation("upscale")
                                    ? "Upscaled ✓"
                                    : "AI Upscale"}
                              </span>
                              {!hasTransformation("upscale") && (
                                <span className="text-muted-foreground ml-1 text-xs">
                                  (1 credit)
                                </span>
                              )}
                            </Button>
                            {hasTransformation("upscale") && (
                              <Button
                                onClick={() => removeTransformation("upscale")}
                                disabled={isProcessing}
                                variant="destructive"
                                size="sm"
                                className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full p-0 opacity-0 transition-opacity group-hover:opacity-100"
                              >
                                <Minus className="h-2 w-2" />
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="rounded-lg border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 p-2">
                          {/* Smart Object Crop Section */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <div className="rounded-full bg-green-500 p-1">
                                <Target className="h-3 w-3 text-white" />
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-green-900">
                                  Smart Object Crop
                                </h4>
                                <p className="text-xs text-green-700">FREE</p>
                              </div>
                            </div>

                            <Input
                              placeholder="Enter object (e.g., person, car)"
                              value={objectInput}
                              onChange={(e) => {
                                setObjectInput(e.target.value);
                              }}
                              disabled={
                                isProcessing || hasTransformation("objectCrop")
                              }
                              className="h-7 border-green-200 bg-white text-xs focus:border-green-400 focus:ring-green-400"
                            />

                            <div className="rounded-md border border-green-200 bg-green-100/50 p-1.5">
                              <p className="text-xs text-green-800">
                                ✨ AI crops around specified object in 1:1 ratio
                              </p>
                            </div>

                            <div className="flex gap-1">
                              <Button
                                onClick={objectCrop}
                                disabled={
                                  isProcessing ||
                                  hasTransformation("objectCrop") ||
                                  !objectInput.trim()
                                }
                                variant="default"
                                size="sm"
                                className="h-7 flex-1 gap-1 bg-green-600 px-2 text-white hover:bg-green-700"
                              >
                                <Target className="h-2 w-2" />
                                <span className="text-xs">
                                  {isProcessing
                                    ? "Processing..."
                                    : hasTransformation("objectCrop")
                                      ? "Applied ✓"
                                      : "Apply"}
                                </span>
                              </Button>
                              {hasTransformation("objectCrop") && (
                                <Button
                                  onClick={() =>
                                    removeTransformation("objectCrop")
                                  }
                                  disabled={isProcessing}
                                  variant="outline"
                                  size="sm"
                                  className="h-7 w-7 border-red-200 p-0 text-red-600 hover:bg-red-50"
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>

                        {transformations.length > 0 && (
                          <div className="py-1 text-center">
                            <div className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
                              <div className="h-1 w-1 rounded-full bg-blue-500"></div>
                              <span className="text-xs">
                                {transformations.length} applied
                              </span>
                            </div>
                          </div>
                        )}

                        {transformations.length > 0 && (
                          <Button
                            onClick={clearTransformations}
                            disabled={isProcessing}
                            variant="destructive"
                            size="sm"
                            className="h-7 w-full gap-1 px-2"
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span className="text-xs">Clear All</span>
                          </Button>
                        )}

                        <div className="grid gap-2 border-t pt-2 sm:grid-cols-2">
                          <Button
                            variant="outline"
                            onClick={selectFile}
                            size="sm"
                            className="h-7 gap-1 px-2"
                          >
                            <Upload className="h-3 w-3" />
                            <span className="text-xs">Upload</span>
                          </Button>
                          {transformations.length > 0 && (
                            <Button
                              onClick={downloadImage}
                              size="sm"
                              className="h-7 gap-1 bg-gradient-to-r from-blue-600 to-purple-600 px-2 hover:from-blue-700 hover:to-purple-700"
                            >
                              <Download className="h-3 w-3" />
                              <span className="text-xs">Download</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Right Side - Image Preview (2/3 width) - Order 1 on mobile */}
                <div className="order-1 space-y-2 sm:space-y-3 lg:order-2 lg:col-span-2">
                  <Card className="shadow-lg">
                    <CardContent className="p-2 sm:p-3">
                      <div className="mb-2 flex items-start justify-between">
                        <div>
                          <h3 className="mb-0.5 text-sm font-bold">Preview</h3>
                          <p className="text-muted-foreground truncate text-xs">
                            {uploadedImage.name}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setUploadedImage(null)}
                          className="hover:bg-destructive/10 hover:text-destructive h-6 w-6 rounded-full p-0"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>

                      <div className="bg-muted relative overflow-hidden rounded-lg border">
                        {isProcessing && (
                          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                            <div className="text-center text-white">
                              <div className="relative mb-2">
                                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
                              </div>
                              <p className="text-sm font-semibold">
                                AI Processing...
                              </p>
                              <p className="mt-1 text-xs text-white/80">
                                Please wait
                              </p>
                            </div>
                          </div>
                        )}
                        <ImageKitImage
                          urlEndpoint={env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT}
                          src={uploadedImage.filePath}
                          alt={uploadedImage.name}
                          width={800}
                          height={600}
                          className="h-auto max-h-[600px] w-full object-contain"
                          transformation={getLivePreviewTransformations()}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-gray-200 bg-white px-2 py-3 sm:px-4 sm:py-4">
            <div className="mx-auto max-w-7xl">
              <div className="mb-6 text-center">
                <div className="mb-2 inline-flex items-center gap-2">
                  <div className="h-6 w-0.5 rounded-full bg-gradient-to-b from-blue-500 to-purple-600"></div>
                  <h2 className="bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-xl font-bold text-transparent">
                    Your Recent Projects
                  </h2>
                  <div className="h-6 w-0.5 rounded-full bg-gradient-to-b from-purple-600 to-blue-500"></div>
                </div>
                <p className="text-muted-foreground mx-auto max-w-md text-sm">
                  Continue editing your previous creations
                </p>
              </div>
            </div>
          </div>

          {isLoadingProjects ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative mb-6">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
                <div className="animate-reverse absolute inset-0 h-12 w-12 animate-spin rounded-full border-4 border-transparent border-r-purple-600"></div>
              </div>
              <div className="text-center">
                <p className="mb-2 text-lg font-semibold text-gray-900">
                  Loading your projects...
                </p>
                <p className="text-muted-foreground text-sm">
                  Fetching your creative works
                </p>
              </div>
            </div>
          ) : userProjects.length > 0 ? (
            <div className="mb-12">
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {userProjects.slice(0, 12).map((project, _index) => (
                  <div
                    key={project.id}
                    className="group relative cursor-pointer"
                    onClick={() => {
                      setUploadedImage({
                        fileId: project.imageKitId,
                        url: project.imageUrl,
                        name: project.name ?? "Untitled",
                        filePath: project.filePath,
                      });
                      setTransformations([]);
                    }}
                  >
                    <div className="relative aspect-square overflow-hidden rounded-2xl border-2 border-gray-200 bg-white shadow-lg transition-all duration-500 hover:-translate-y-2 hover:border-blue-300 hover:shadow-2xl">
                      {/* Hover overlay with gradient */}
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-500/0 to-purple-600/0 transition-all duration-500 group-hover:from-blue-500/20 group-hover:to-purple-600/20"></div>

                      {/* Main image */}
                      <div className="relative h-full w-full overflow-hidden">
                        <ImageKitImage
                          urlEndpoint={env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT}
                          src={project.filePath}
                          alt={project.name ?? "Project"}
                          width={300}
                          height={300}
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                          transformation={[
                            {
                              width: 300,
                              height: 300,
                              crop: "maintain_ratio",
                              quality: 90,
                            },
                          ]}
                        />

                        {/* Shimmer effect on hover */}
                        <div className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 transition-transform duration-1000 group-hover:translate-x-full group-hover:opacity-100"></div>
                      </div>

                      {/* Content overlay */}
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 transform bg-gradient-to-t from-black/80 via-black/50 to-transparent p-4 transition-transform duration-300 group-hover:translate-y-0">
                        <div className="space-y-1">
                          <h3 className="truncate text-sm font-bold text-white drop-shadow-lg">
                            {project.name ?? "Untitled Project"}
                          </h3>
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-white/90 drop-shadow-md">
                              {new Date(project.createdAt).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                },
                              )}
                            </p>
                            <div className="opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                              <div className="rounded-full bg-white/20 px-2 py-1 backdrop-blur-sm">
                                <span className="text-xs font-medium text-white">
                                  Edit
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Corner accent */}
                      <div className="absolute top-0 right-0 h-0 w-0 border-t-[20px] border-l-[20px] border-t-blue-500 border-l-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Show more indicator if there are more than 12 projects */}
              {userProjects.length > 12 && (
                <div className="mt-8 text-center">
                  <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50 px-6 py-3">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-blue-500"></div>
                    <span className="text-sm font-medium text-blue-700">
                      Showing 12 of {userProjects.length} projects
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-16 text-center">
              <div className="relative mx-auto mb-8">
                {/* Animated background circles */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-32 w-32 animate-pulse rounded-full bg-gradient-to-br from-blue-100 to-purple-100"></div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className="h-24 w-24 animate-pulse rounded-full bg-gradient-to-br from-blue-200 to-purple-200"
                    style={{ animationDelay: "1s" }}
                  ></div>
                </div>

                {/* Icon container */}
                <div className="relative z-10 mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-gray-300 bg-white shadow-lg">
                  <ImageIcon className="h-10 w-10 text-gray-400" />
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xl font-bold text-gray-900">
                  No projects yet
                </h3>
                <p className="text-muted-foreground mx-auto max-w-md text-lg leading-relaxed">
                  Start your creative journey by uploading your first image and
                  transforming it with AI
                </p>
              </div>
            </div>
          )}
        </div>
      </SignedIn>
    </>
  );
}
