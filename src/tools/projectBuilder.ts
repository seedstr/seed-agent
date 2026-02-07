import { mkdirSync, writeFileSync, existsSync, rmSync, readdirSync, statSync, readFileSync } from "fs";
import { join, dirname, basename } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import archiver from "archiver";
import { createWriteStream } from "fs";
import { logger } from "../utils/logger.js";

export interface ProjectFile {
  path: string; // Relative path within the project (e.g., "src/index.html")
  content: string; // File content
}

export interface ProjectBuildResult {
  success: boolean;
  projectDir: string;
  zipPath: string;
  files: string[];
  totalSize: number;
  error?: string;
}

/**
 * ProjectBuilder - Creates project files and packages them into a zip
 */
export class ProjectBuilder {
  private projectDir: string;
  private files: Map<string, string> = new Map();

  constructor(projectName?: string) {
    const name = projectName || `project-${randomUUID().slice(0, 8)}`;
    this.projectDir = join(tmpdir(), "seedstr-builds", name);
    
    // Clean up if exists
    if (existsSync(this.projectDir)) {
      rmSync(this.projectDir, { recursive: true, force: true });
    }
    
    // Create project directory
    mkdirSync(this.projectDir, { recursive: true });
    logger.debug(`Created project directory: ${this.projectDir}`);
  }

  /**
   * Add a file to the project
   */
  addFile(relativePath: string, content: string): void {
    // Normalize path separators
    const normalizedPath = relativePath.replace(/\\/g, "/");
    this.files.set(normalizedPath, content);
    
    // Write file to disk
    const fullPath = join(this.projectDir, normalizedPath);
    const dir = dirname(fullPath);
    
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    
    writeFileSync(fullPath, content, "utf-8");
    logger.debug(`Added file: ${normalizedPath} (${content.length} bytes)`);
  }

  /**
   * Add multiple files at once
   */
  addFiles(files: ProjectFile[]): void {
    for (const file of files) {
      this.addFile(file.path, file.content);
    }
  }

  /**
   * Get list of all files in the project
   */
  getFiles(): string[] {
    return Array.from(this.files.keys());
  }

  /**
   * Get the project directory path
   */
  getProjectDir(): string {
    return this.projectDir;
  }

  /**
   * Calculate total size of all files
   */
  private getTotalSize(): number {
    let total = 0;
    for (const content of this.files.values()) {
      total += Buffer.byteLength(content, "utf-8");
    }
    return total;
  }

  /**
   * Package the project into a zip file
   */
  async createZip(zipName?: string): Promise<ProjectBuildResult> {
    const name = zipName || `${basename(this.projectDir)}.zip`;
    const zipPath = join(dirname(this.projectDir), name);

    return new Promise((resolve) => {
      try {
        const output = createWriteStream(zipPath);
        const archive = archiver("zip", {
          zlib: { level: 9 }, // Maximum compression
        });

        output.on("close", () => {
          logger.debug(`Created zip: ${zipPath} (${archive.pointer()} bytes)`);
          resolve({
            success: true,
            projectDir: this.projectDir,
            zipPath,
            files: this.getFiles(),
            totalSize: archive.pointer(),
          });
        });

        archive.on("error", (err) => {
          logger.error("Archive error:", err);
          resolve({
            success: false,
            projectDir: this.projectDir,
            zipPath: "",
            files: this.getFiles(),
            totalSize: 0,
            error: err.message,
          });
        });

        archive.pipe(output);

        // Add all files in the project directory
        archive.directory(this.projectDir, false);

        archive.finalize();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("Failed to create zip:", message);
        resolve({
          success: false,
          projectDir: this.projectDir,
          zipPath: "",
          files: this.getFiles(),
          totalSize: 0,
          error: message,
        });
      }
    });
  }

  /**
   * Clean up the project directory
   */
  cleanup(): void {
    try {
      if (existsSync(this.projectDir)) {
        rmSync(this.projectDir, { recursive: true, force: true });
        logger.debug(`Cleaned up project directory: ${this.projectDir}`);
      }
    } catch (error) {
      logger.error("Failed to cleanup project directory:", error);
    }
  }
}

/**
 * Build a project from a list of files and return the zip path
 */
export async function buildProject(
  projectName: string,
  files: ProjectFile[]
): Promise<ProjectBuildResult> {
  const builder = new ProjectBuilder(projectName);
  builder.addFiles(files);
  return builder.createZip();
}

/**
 * Get the zip file as a Buffer for uploading
 */
export function getZipBuffer(zipPath: string): Buffer {
  return readFileSync(zipPath);
}

/**
 * Clean up a project's files and zip
 */
export function cleanupProject(projectDir: string, zipPath?: string): void {
  try {
    if (existsSync(projectDir)) {
      rmSync(projectDir, { recursive: true, force: true });
    }
    if (zipPath && existsSync(zipPath)) {
      rmSync(zipPath, { force: true });
    }
  } catch (error) {
    logger.error("Failed to cleanup:", error);
  }
}

export default ProjectBuilder;
