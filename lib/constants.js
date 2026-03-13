export const SERVICE_KEYS = [
  { key: 'service_seo', label: 'SEO', color: '#6366f1', icon: '◎' },
  { key: 'service_gbp', label: 'GBP', color: '#10b981', icon: '📍' },
  { key: 'service_ads', label: 'Ads', color: '#f59e0b', icon: '▲' },
  { key: 'service_social', label: 'Social', color: '#ec4899', icon: '◈' },
  { key: 'service_crm', label: 'CRM', color: '#3b82f6', icon: '◧' },
];

export const STATUS_COLORS = {
  Active: '#10b981',
  Paused: '#f59e0b',
  Churned: '#ef4444',
  Lead: '#3b82f6',
  Prospect: '#8b5cf6',
};

export const PRIORITY_COLORS = {
  High: '#ef4444',
  Medium: '#f59e0b',
  Low: '#10b981',
};

export const TASK_STATUS_COLORS = {
  'Not Started': '#64748b',
  'In Progress': '#3b82f6',
  'Pending Client Approval': '#f59e0b',
  Done: '#10b981',
  Blocked: '#ef4444',
};

export const TASK_STATUSES = ['Not Started', 'In Progress', 'Pending Client Approval', 'Done', 'Blocked'];
export const TASK_PRIORITIES = ['High', 'Medium', 'Low'];

export const CONTENT_TYPE_COLORS = {
  'Blog Post': '#6366f1',
  'GBP Post': '#10b981',
  'Social Post': '#ec4899',
  'Landing Page': '#8b5cf6',
  Email: '#3b82f6',
  'Ad Copy': '#f59e0b',
  'Video Script': '#14b8a6',
  Other: '#64748b',
};

export const CONTENT_TYPES = ['Blog Post', 'GBP Post', 'Social Post', 'Landing Page', 'Email', 'Ad Copy', 'Video Script', 'Other'];

export const CONTENT_STATUS_COLORS = {
  'Not Started': '#64748b',
  'In Progress': '#3b82f6',
  Review: '#f59e0b',
  Approved: '#8b5cf6',
  Published: '#10b981',
};

export const CONTENT_STATUSES = ['Not Started', 'In Progress', 'Review', 'Approved', 'Published'];

export const ACTIVITY_TYPES = [
  { value: 'Note', label: 'Note', badge: '📝' },
  { value: 'Call', label: 'Call', badge: '📞' },
  { value: 'Email', label: 'Email', badge: '📧' },
  { value: 'Meeting', label: 'Meeting', badge: '👥' },
  { value: 'Update', label: 'Update', badge: '🔄' },
  { value: 'Other', label: 'Other', badge: '📌' },
];

export const WIKI_SECTIONS = {
  keyword_database: { label: 'Keyword Database', color: '#6366f1', icon: '🔑' },
  website_architecture: { label: 'Website Architecture', color: '#8b5cf6', icon: '🏗' },
  seo_elements: { label: 'SEO / GSC', color: '#10b981', icon: '📊' },
  paid_media: { label: 'Paid Media', color: '#f59e0b', icon: '💰' },
  brand_assets: { label: 'Brand Assets', color: '#ec4899', icon: '🎨' },
  services_sheet: { label: 'Services Sheet', color: '#06b6d4', icon: '📋' },
  reporting: { label: 'Reporting / Analytics', color: '#14b8a6', icon: '📈' },
  external_docs: { label: 'External Docs', color: '#64748b', icon: '📄' },
  social_media: { label: 'Social Media', color: '#ef4444', icon: '📱' },
  client_files: { label: 'Client Files', color: '#a855f7', icon: '📁' },
};
