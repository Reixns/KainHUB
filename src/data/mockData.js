// Seed data for Lancaster Zone 1 Eats

// Initial vendors
export const INITIAL_VENDORS = [];

// Initial customers
export const INITIAL_CUSTOMERS = [];

// Initial admin
export const INITIAL_ADMINS = [
  {
    id: 1,
    fullName: 'Platform Administrator',
    email: 'admin@example.com',
    password: '123123',
    mobile: '',
    role: 'admin',
    avatar: '🛡️',
  },
];

// Initial orders (sample completed orders)
export const INITIAL_ORDERS = [];

// Initial marketplace posts
export const INITIAL_POSTS = [];

export const INITIAL_NOTIFICATIONS = [];

export const ORDER_STATUSES_PICKUP = ['RECEIVED', 'PREPARING', 'READY', 'COMPLETED'];
export const ORDER_STATUSES_DELIVERY = ['RECEIVED', 'PREPARING', 'READY', 'OUT FOR DELIVERY', 'COMPLETED'];

export const STATUS_COLORS = {
  RECEIVED: 'bg-blue-100 text-blue-700 border-blue-200',
  PREPARING: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  READY: 'bg-success-soft text-success border-success/30',
  'OUT FOR DELIVERY': 'bg-purple-100 text-purple-700 border-purple-200',
  COMPLETED: 'bg-gray-100 text-gray-700 border-gray-200',
  CANCELLED: 'bg-danger-soft text-red-700 border-danger/30',
  REJECTED: 'bg-danger-soft text-red-700 border-danger/30',
};

export const PLATFORM_SETTINGS = {
  logo: '/khlogo.png',
  deliveryEnabled: true,
};
