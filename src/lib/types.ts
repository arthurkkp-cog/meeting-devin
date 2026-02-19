export interface UploadedFile {
  id: string;
  file: File;
  type: "video" | "document";
  name: string;
  size: number;
}

export interface LinkItem {
  id: string;
  url: string;
}

export interface UploadPayload {
  files: UploadedFile[];
  links: LinkItem[];
}

export interface UploadResponse {
  meeting_id: string;
  status: "uploaded" | "processing" | "failed";
  file_count: number;
  link_count: number;
  message: string;
}
