export type ShipmentStatus = 'In Transit' | 'Delivered' | 'Pending' | 'Delayed' | 'Cancelled' | 'Out for Delivery' | 'In Warehouse';

export interface Shipment {
  id: string;
  trackingNumber: string;
  senderName: string;
  recipientName: string;
  origin: string;
  destination: string;
  status: ShipmentStatus;
  shipmentType?: string;
  paymentMode?: string;
  lastUpdatedLocation: string;
  remarks: string;
  lastUpdatedDate: string;
  estimatedDeliveryDate: string;
  createdAt: string;
  createdByEmail?: string;
  updatedByEmail?: string;
  history?: Array<{
    updatedByEmail: string;
    updatedAt: string;
    status: ShipmentStatus;
    location: string;
  }>;
}

export interface TrackingEvent {
  id: string;
  status: ShipmentStatus;
  location: string;
  remarks: string;
  timestamp: string;
}

export interface RegisteredUser {
  id: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: 'admin' | 'user';
  isEnabled: boolean;
  createdAt: string;
  lastLoginAt?: string;
  updatedAt?: string;
  notes?: string;
}

