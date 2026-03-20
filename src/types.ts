export interface Service {
  id: string;
  name: string;
  price: number;
  duration: string;
  description: string;
}

export interface BusinessHours {
  day: string;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

export interface Appointment {
  id: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  service_id: string;
  service_name?: string;
  services?: string[];
  duration: number;
  totalPrice: number;
  date: string;
  time: string;
  image_url?: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  notes?: string;
  consent?: boolean;
}

export interface GalleryImage {
  id: string;
  url: string;
  caption?: string;
}

export interface SalonEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  description: string;
  capacity: number;
  registration_count: number;
}
