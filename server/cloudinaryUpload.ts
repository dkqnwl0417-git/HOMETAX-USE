import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadToCloudinary(fileBuffer: Buffer, originalName: string) {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    throw new Error("Cloudinary 설정이 완료되지 않았습니다.");
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "auto",
        folder: "hometax_manual",
        // 한글 파일명 보존을 위해 public_id 설정 (특수문자 제거)
        public_id: `file_${Date.now()}`,
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error("Upload failed"));

        resolve({
          fileUrl: result.secure_url,
          fileType: result.format || originalName.split('.').pop() || "file",
          originalName: originalName,
        });
      }
    );

    uploadStream.end(fileBuffer);
  });
}
