export interface Service {
  id: number;
  name: string;
  price: number;
  duration: string;
  description: string;
}

export interface BusinessHours {
  day: string;
  open_time: string;
  close_time: string;
  is_closed: number;
}

export interface Appointment {
  id: number;
  client_name: string;
  client_email: string;
  client_phone: string;
  service_id: number;
  service_name?: string;
  services?: string[];
  duration?: number;
  date: string;
  time: string;
  image_url?: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  notes?: string;
  consent?: boolean | number;
}

export interface GalleryImage {
  id: number;
  url: string;
  caption?: string;
}

export interface SalonEvent {
  id: number;
  title: string;
  date: string;
  time: string;
  description: string;
  capacity: number;
  registration_count?: number;
}
