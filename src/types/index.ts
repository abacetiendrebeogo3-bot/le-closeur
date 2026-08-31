export interface Message {
  sender: "customer" | "ai" | "human";
  text: string;
  time: string;
}

export interface Conversation {
  id: number;
  customerName: string;
  customerPhone: string;
  status: "ai_active" | "human_takeover" | "closed";
  avatar: string;
  unread: boolean;
  engagementStatus?: string;
  messages: Message[];
}

export interface OrderItem {
  product: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  customer: string;
  customerPhone: string;
  customerAddress: string;
  date: string;
  status: "discussing" | "confirmed" | "courier_assigned" | "sent_to_courier" | "shipping" | "delivered" | "paid" | "cancelled";
  paymentStatus: "paid" | "pending" | "overdue";
  total: number;
  shippingFee: number;
  deliveryZone: string;
  items: OrderItem[];
  courier?: string;
  chatId?: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  firstContact: string;
  tags: string[];
  totalSpent: number;
}

export interface Courier {
  id: string;
  name: string;
  phone: string;
  active: boolean;
  load: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  active: boolean;
  stock?: number;
  imageUrl?: string;
  imageUrls?: string[];
  description?: string;
  testimonials?: string;
  buying_price?: number;
}

export interface Zone {
  id: string;
  name: string;
  fee: number;
  deliveryTime: string;
}

export interface FollowupStep {
  id: string;
  delayValue: number;
  delayUnit: "hours" | "days";
  name: string;
  messageText: string;
  metaTemplateName: string;
  active?: boolean;
}

export interface Employee {
  id: string;
  business_id: string;
  name: string;
  role: string;
  monthly_salary: number;
  pay_day: number;
  created_at?: string;
}

export interface Debt {
  id: string;
  business_id: string;
  label: string;
  amount: number;
  due_date: string;
  paid_amount: number;
  created_at?: string;
}

export interface BusinessPhoneNumber {
  id: string;
  business_id: string;
  phone_number_id: string;
  waba_id?: string;
  access_token?: string;
  conversation_mode?: string;
  label?: string;
  created_at?: string;
}
