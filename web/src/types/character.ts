export interface Character {
  id: string;
  name: string;
  role: string;
  desc: string;
  tags: string[];
  ref_image_url: string | null;
  ref_images: string[];
  voice_sample_url: string | null;
  hue: number;
  has_ref: boolean;
  created_at: string;
  updated_at: string;
}
