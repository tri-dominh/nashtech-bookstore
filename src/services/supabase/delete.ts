import { Logger } from '@nestjs/common';
import { supabase } from '.';

const BUCKET = process.env.SUPABASE_BUCKET || 'images';

const parseFilePath = (publicUrl: string): string => {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) throw new Error(`Cannot parse Supabase URL: ${publicUrl}`);
  return publicUrl.slice(idx + marker.length);
};

export const deleteFiles = async (urls: string[]) => {
  try {
    const paths = urls.map(parseFilePath);
    const { error } = await supabase.storage.from(BUCKET).remove(paths);

    if (error) {
      Logger.error('Error deleting files from Supabase Storage:', error.message);
      return { success: false };
    }

    return { success: true };
  } catch (error) {
    Logger.error('Error deleting files from Supabase Storage:', error);
    return { success: false };
  }
};
