import 'multer';
import { EUploadFolder } from 'src/constants/image';
import { supabase } from '.';

const BUCKET = process.env.SUPABASE_BUCKET || 'images';

export const uploadFiles = async (
  filesContent: Express.Multer.File[],
  uploadFolder: EUploadFolder,
) => {
  try {
    const urls = await Promise.all(
      filesContent.map(async (item) => {
        const sanitized = item.originalname
          .replace(/\s+/g, '-')
          .replace(/[^a-zA-Z0-9.\-_]/g, '');
        const filename = `${Date.now()}-${sanitized}`;
        const filePath = `${uploadFolder}/${filename}`;

        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(filePath, item.buffer, {
            contentType: item.mimetype,
            upsert: false,
          });

        if (error) {
          console.error('Supabase upload error:', error.message);
          throw error;
        }

        const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
        return data.publicUrl;
      }),
    );

    return { success: true, urls };
  } catch (error) {
    return { success: false, urls: [] };
  }
};
