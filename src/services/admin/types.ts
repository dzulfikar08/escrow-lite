/**
 * Admin Service Types
 */

export type DisputeStatus = 'open' | 'seller_responding' | 'under_review' | 'resolved' | 'closed';

export type DisputeResolution =
  | 'released_to_seller'
  | 'refunded_to_buyer'
  | 'partial'
  | 'rejected';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'super_admin';
  is_active: boolean;
  created_at: string;
}
