import type { ItemMaster, DivisionMatrix } from '../types';

export const SEED_ITEMS: Omit<ItemMaster, 'id'>[] = [
  { title: 'ThinkPad L14 Gen 4', sku: 'IT-LAP-001', description: 'Intel i7, 16GB RAM, 512GB SSD. Corporate standard developer laptop.', category: 'IT Equipment', unit: 'Unit', unitPrice: 1200, stockOnHand: 15, reorderLevel: 3 },
  { title: 'Logitech MX Master 3S', sku: 'IT-MOU-002', description: 'Ergonomic wireless mouse with silent clicks and 8K DPI sensor.', category: 'IT Equipment', unit: 'Unit', unitPrice: 99, stockOnHand: 42, reorderLevel: 5 },
  { title: 'Dell UltraSharp 27 Monitor', sku: 'IT-MON-003', description: 'U2723QE 4K USB-C Hub Monitor. IPS Black panel.', category: 'IT Equipment', unit: 'Unit', unitPrice: 450, stockOnHand: 7, reorderLevel: 2 },
  { title: 'Standing Desk Dual Motor', sku: 'FU-DSK-004', description: 'Electric height adjustable desk frame with bamboo wood top.', category: 'Furniture', unit: 'Unit', unitPrice: 550, stockOnHand: 4, reorderLevel: 1 },
  { title: 'Ergonomic Office Chair', sku: 'FU-CHR-005', description: 'Mesh high-back chair with lumbar support and adjustable armrests.', category: 'Furniture', unit: 'Unit', unitPrice: 299, stockOnHand: 12, reorderLevel: 2 },
  { title: 'Apple MacBook Pro 14"', sku: 'IT-LAP-006', description: 'M3 Pro chip, 18GB Unified Memory, 512GB SSD. Space Black.', category: 'IT Equipment', unit: 'Unit', unitPrice: 1999, stockOnHand: 3, reorderLevel: 1 },
  { title: 'USB-C Multiport Adapter', sku: 'IT-ACC-007', description: '7-in-1 adapter with HDMI, USB-A, SD Card Slot, and Pass-through Charging.', category: 'IT Equipment', unit: 'Unit', unitPrice: 59, stockOnHand: 60, reorderLevel: 10 },
  { title: 'Premium A4 Copier Paper', sku: 'OF-PAP-008', description: 'High-quality 80gsm copy paper. Box of 5 reams.', category: 'Office Supplies', unit: 'Box', unitPrice: 35, stockOnHand: 25, reorderLevel: 5 }
];

export const SEED_DIVISIONS: Omit<DivisionMatrix, 'id'>[] = [
  { title: 'Engineering', hodEmail: 'dave.head@company.com', hodName: 'Dave Head (HOD)', financeEmail: 'fiona.fin@company.com', financeName: 'Fiona Fin (Finance Head)', requesters: 'alex.req@company.com;darshana@aatsl.lk' },
  { title: 'Marketing', hodEmail: 'mary.head@company.com', hodName: 'Mary Head (HOD)', financeEmail: 'fiona.fin@company.com', financeName: 'Fiona Fin (Finance Head)', requesters: 'emily.req@company.com' },
  { title: 'Human Resources', hodEmail: 'harry.head@company.com', hodName: 'Harry Head (HOD)', financeEmail: 'fiona.fin@company.com', financeName: 'Fiona Fin (Finance Head)', requesters: 'john.req@company.com' },
  { title: 'Sales', hodEmail: 'sarah.head@company.com', hodName: 'Sarah Head (HOD)', financeEmail: 'fiona.fin@company.com', financeName: 'Fiona Fin (Finance Head)', requesters: '' }
];
