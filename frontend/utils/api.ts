import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth APIs
export const authAPI = {
  register: (data: { email: string; password: string; name: string; captcha_token?: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string; captcha_token?: string; totp_code?: string }) =>
    api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),
  verifyResetCode: (email: string, code: string) =>
    api.post('/auth/verify-reset-code', null, { params: { email, code } }),
  resetPassword: (email: string, code: string, new_password: string) =>
    api.post('/auth/reset-password', { email, code, new_password }),
};

// Crypto APIs
export const cryptoAPI = {
  getPrices: () => api.get('/crypto/prices'),
  getTrending: () => api.get('/crypto/trending'),
  getGlobalStats: () => api.get('/crypto/global'),
  getChart: (coinId: string, days: string = '7') => api.get(`/crypto/chart/${coinId}`, { params: { days } }),
};

// Education APIs
export const educationAPI = {
  getModules: () => api.get('/education/modules'),
  getModule: (id: string) => api.get(`/education/modules/${id}`),
};

// Progress APIs
export const progressAPI = {
  getProgress: () => api.get('/progress'),
  updateProgress: (data: { module_id: string; completed: boolean; score?: number }) =>
    api.post('/progress/update', data),
};

// AI APIs
export const aiAPI = {
  ask: (query: string, context?: string) =>
    api.post('/ai/ask', { query, context }),
};

// Tools APIs
export const toolsAPI = {
  getChecklist: () => api.get('/tools/checklist'),
};

// Community APIs
export const communityAPI = {
  // Categories
  getCategories: () => api.get('/community/categories'),
  
  // Posts
  getPosts: (params?: { category?: string; search?: string; sort_by?: string; limit?: number; skip?: number }) =>
    api.get('/community/posts', { params }),
  getPost: (postId: string) => api.get(`/community/posts/${postId}`),
  createPost: (data: { title: string; content: string; category: string; image_url?: string | null }) =>
    api.post('/community/posts', data),
  deletePost: (postId: string) => api.delete(`/community/posts/${postId}`),
  
  // Image upload
  uploadImage: (base64Data: string) => api.post('/upload/image', { image_base64: base64Data }),
  
  // Likes
  likePost: (postId: string) => api.post(`/community/posts/${postId}/like`),
  
  // Bookmarks
  bookmarkPost: (postId: string) => api.post(`/community/posts/${postId}/bookmark`),
  getBookmarks: () => api.get('/community/bookmarks'),
  
  // Comments
  addComment: (postId: string, content: string) =>
    api.post(`/community/posts/${postId}/comments`, { content }),
  
  // Votes
  votePost: (postId: string, voteType: 'up' | 'down') =>
    api.post(`/community/posts/${postId}/vote`, { vote_type: voteType }),
  voteComment: (commentId: string, voteType: 'up' | 'down') =>
    api.post(`/community/comments/${commentId}/vote`, { vote_type: voteType }),
  
  // Wiki
  getWikiArticles: () => api.get('/community/wiki'),
  getWikiArticle: (articleId: string) => api.get(`/community/wiki/${articleId}`),
  
  // User posts
  getUserPosts: (userId: string) => api.get(`/community/user/${userId}/posts`),
  
  // Leaderboard
  getLeaderboard: () => api.get('/community/leaderboard'),
};

// News APIs
export const newsAPI = {
  getNews: (params?: { category?: string; limit?: number; skip?: number; query?: string; lang?: string }) =>
    api.get('/news', { params }),
  getNewsDetail: (newsId: string) => api.get(`/news/${newsId}`),
  getTrendingNews: (params?: { lang?: string }) => api.get('/news/trending', { params }),
  getFlashNews: (params?: { lang?: string }) => api.get('/news/flash', { params }),
};

// Admin APIs
export const adminAPI = {
  // Stats
  getStats: () => api.get('/admin/stats'),
  
  // Users
  getUsers: (params?: { search?: string; role_filter?: string; banned_only?: boolean; limit?: number; skip?: number }) =>
    api.get('/admin/users', { params }),
  getUserDetail: (userId: string) => api.get(`/admin/users/${userId}`),
  promoteUser: (userId: string, role: string) =>
    api.put(`/admin/users/${userId}/promote`, { role }),
  banUser: (userId: string, reason?: string) =>
    api.put(`/admin/users/${userId}/ban`, { reason }),
  unbanUser: (userId: string) =>
    api.put(`/admin/users/${userId}/unban`),
  setUserVIP: (userId: string, isVip: boolean, months?: number) =>
    api.put(`/admin/users/${userId}/set-vip`, null, { params: { is_vip: isVip, months: months || 1 } }),
  setUserPro: (userId: string, isPro: boolean, badgeLevel?: string) =>
    api.put(`/admin/users/${userId}/set-pro`, null, { params: { is_pro: isPro, badge_level: badgeLevel || 'basic' } }),
  
  // Content moderation
  getPosts: (params?: { search?: string; category?: string; limit?: number; skip?: number }) =>
    api.get('/admin/posts', { params }),
  deletePost: (postId: string) => api.delete(`/admin/posts/${postId}`),
  deleteComment: (commentId: string) => api.delete(`/admin/comments/${commentId}`),
  
  // Logs
  getLogs: (params?: { limit?: number; skip?: number }) =>
    api.get('/admin/logs', { params }),
};

// VIP APIs
export const vipAPI = {
  getFeatures: (params?: { lang?: string }) => api.get('/vip/features', { params }),
  getStatus: () => api.get('/vip/status'),
  createCheckout: (originUrl: string, refCode?: string) => 
    api.post('/vip/checkout', { origin_url: originUrl, ref_code: refCode || '' }),
  checkPaymentStatus: (sessionId: string) =>
    api.get(`/vip/checkout/status/${sessionId}`),
  
  // Alerts
  getAlerts: () => api.get('/vip/alerts'),
  createAlert: (data: { crypto_symbol: string; alert_type: string; target_value: number; notification_method?: string }) =>
    api.post('/vip/alerts', data),
  deleteAlert: (alertId: string) => api.delete(`/vip/alerts/${alertId}`),
  
  // Smart Money
  getSmartMoney: (params?: { limit?: number; crypto?: string }) =>
    api.get('/vip/smart-money', { params }),
  
  // Wallet / Portfolio
  getWallet: () => api.get('/vip/wallet'),
  addWalletAsset: (data: { symbol: string; name: string; amount: number; buy_price: number }) =>
    api.post('/vip/wallet', data),
  removeWalletAsset: (assetId: string) => api.delete(`/vip/wallet/${assetId}`),
  
  // Gamification
  getAchievements: () => api.get('/vip/achievements'),
  getLeaderboard: (limit?: number) => api.get('/vip/leaderboard', { params: { limit } }),
  getGamificationStats: () => api.get('/vip/gamification/stats'),
  
  // Advanced Academy
  getAdvancedCourses: (params?: { lang?: string }) => api.get('/vip/academy', { params }),
  updateCourseProgress: (courseId: string, progressPercent: number) =>
    api.post(`/vip/academy/${courseId}/progress`, null, { params: { progress_percent: progressPercent } }),
  getDailyBriefing: (lang?: string) => api.get('/vip/daily-briefing', { params: { lang: lang || 'en' } }),
  
  // Copy Trading
  getCopyTraders: () => api.get('/vip/copy-trading/traders'),
  followTrader: (traderId: string) => api.post(`/vip/copy-trading/follow/${traderId}`),
  unfollowTrader: (traderId: string) => api.delete(`/vip/copy-trading/follow/${traderId}`),
  getCopyTradingPortfolio: () => api.get('/vip/copy-trading/portfolio'),
  
  // Social
  getSocialFeed: (params?: { limit?: number; skip?: number; topic?: string }) =>
    api.get('/vip/social/feed', { params }),
  getTrendingTopics: () => api.get('/vip/social/trending'),
  getEnhancedSocialFeed: (params?: { limit?: number; skip?: number }) =>
    api.get('/vip/social/feed/enhanced', { params }),
  createSocialPost: (content: string, cryptoMentions: string[] = []) =>
    api.post('/vip/social/posts', null, { params: { content, crypto_mentions: cryptoMentions } }),
  createSocialPostWithImage: (data: { content: string; image_base64?: string; crypto_mentions?: string[] }) =>
    api.post('/vip/social/posts/create', data),
  likePost: (postId: string) => api.post(`/vip/social/posts/${postId}/like`),
  getPostComments: (postId: string) => api.get(`/vip/social/posts/${postId}/comments`),
  addComment: (postId: string, content: string) =>
    api.post(`/vip/social/posts/${postId}/comments`, null, { params: { content } }),
  getPostImage: (postId: string) => api.get(`/vip/social/posts/${postId}/image`),
  
  // AI Analysis
  analyzeWithAI: (query: string, cryptoSymbol?: string, analysisType?: string) =>
    api.post('/vip/ai/analyze', null, { params: { query, crypto_symbol: cryptoSymbol, analysis_type: analysisType } }),
  analyzeImageWithAI: (data: { query: string; image_base64: string; analysis_type?: string }) =>
    api.post('/vip/ai/analyze-image', data),

  // Stories
  getStories: () => api.get('/vip/stories'),
  createStory: (data: { image_base64: string; text_overlay?: string; background_color?: string }) =>
    api.post('/vip/stories/create', data),
  viewStory: (storyId: string) => api.post(`/vip/stories/${storyId}/view`),
  reactToStory: (storyId: string, reaction: string) =>
    api.post(`/vip/stories/${storyId}/react`, null, { params: { reaction } }),
  deleteStory: (storyId: string) => api.delete(`/vip/stories/${storyId}`),

  // Push Notifications
  registerPushToken: (data: { token: string; device_type: string }) =>
    api.post('/notifications/register-token', data),
  unregisterPushToken: (token: string) =>
    api.delete('/notifications/unregister-token', { params: { token } }),
  getNotificationHistory: (limit?: number) =>
    api.get('/notifications/history', { params: { limit } }),
  markNotificationsRead: (notificationIds?: string[]) =>
    api.post('/notifications/mark-read', { notification_ids: notificationIds || [] }),
  
  // Crypto Tools
  getCryptoTools: () => api.get('/vip/tools/all'),
  getFearGreedIndex: () => api.get('/vip/tools/fear-greed'),
  getHalvingCountdown: () => api.get('/vip/tools/halving'),
  
  // Alerts with crypto selection
  getAvailableCryptos: () => api.get('/vip/alerts/cryptos'),
  checkCryptoPrice: (symbol: string) => api.get(`/vip/alerts/check/${symbol}`),
};

// User Profiles API
export const profileAPI = {
  getMyProfile: () => api.get('/users/me/profile'),
  updateMyProfile: (data: {
    name?: string;
    bio?: string;
    avatar_color?: string;
    favorite_crypto?: string;
    trading_experience?: string;
    is_public?: boolean;
  }) => api.put('/users/me/profile', data),
  getUserProfile: (userId: string) => api.get(`/users/${userId}/profile`),
  searchUsers: (query: string, limit?: number) => 
    api.get('/users/search', { params: { q: query, limit } }),
  followUser: (userId: string) => api.post(`/users/${userId}/follow`),
  getFollowers: (userId: string, limit?: number) => 
    api.get(`/users/${userId}/followers`, { params: { limit } }),
  getFollowing: (userId: string, limit?: number) => 
    api.get(`/users/${userId}/following`, { params: { limit } }),
};

// Messaging API
export const messageAPI = {
  getConversations: () => api.get('/messages/conversations'),
  getMessages: (userId: string, limit?: number) => 
    api.get(`/messages/${userId}`, { params: { limit } }),
  sendMessage: (userId: string, content: string) => 
    api.post(`/messages/${userId}`, { content }),
};

// Notifications API
export const notificationAPI = {
  getNotifications: (limit?: number) => 
    api.get('/notifications', { params: { limit } }),
  markAllRead: () => api.post('/notifications/read'),
  registerPushToken: (token: string) => 
    api.post('/notifications/register-token', null, { params: { token } }),
};

// Professional Marketplace API
export const proAPI = {
  getInfo: () => api.get('/pro/info'),
  apply: (data: any) => api.post('/pro/apply', data),
  getApplicationStatus: () => api.get('/pro/application/status'),
  getProfile: () => api.get('/pro/profile'),
  getProfessionals: (params?: { 
    expertise?: string; 
    language?: string; 
    min_rating?: number; 
    max_price?: number; 
    search?: string;
    badge_level?: string;
    sort_by?: string;
    limit?: number; 
    skip?: number;
  }) => api.get('/pros', { params }),
  getProfessionalById: (proId: string) => api.get(`/pros/${proId}`),
  
  // Admin endpoints
  getApplications: (params?: { status?: string; limit?: number; skip?: number }) =>
    api.get('/admin/pro/applications', { params }),
  reviewApplication: (applicationId: string, decision: string, badgeLevel?: string, adminNotes?: string) =>
    api.put(`/admin/pro/applications/${applicationId}/review`, null, { 
      params: { decision, badge_level: badgeLevel, admin_notes: adminNotes } 
    }),
    
  // Dashboard endpoints
  getDashboard: () => api.get('/pro/dashboard'),
  updateProfile: (data: { bio?: string; hourly_rate?: number; is_available?: boolean; specializations?: string[]; languages?: string[] }) =>
    api.put('/pro/dashboard/profile', data),
  createService: (data: { service_type: string; title: string; description: string; price: number; duration_minutes?: number; max_participants?: number; is_active?: boolean }) =>
    api.post('/pro/dashboard/services', data),
  updateService: (serviceId: string, data: any) => api.put(`/pro/dashboard/services/${serviceId}`, data),
  deleteService: (serviceId: string) => api.delete(`/pro/dashboard/services/${serviceId}`),
  requestWithdrawal: (data: { amount: number; payment_method: string; payment_details: string }) =>
    api.post('/pro/dashboard/withdraw', data),
  getBookings: (params?: { status?: string; limit?: number; skip?: number }) =>
    api.get('/pro/dashboard/bookings', { params }),
  updateBookingStatus: (bookingId: string, status: string) =>
    api.put(`/pro/dashboard/bookings/${bookingId}/status`, null, { params: { status } }),
    
  // Client booking endpoints
  getProServices: (proId: string) => api.get(`/pros/${proId}/services`),
  getAvailableSlots: (serviceId: string, date: string) => 
    api.get(`/services/${serviceId}/available-slots`, { params: { date } }),
  createBooking: (data: { service_id: string; scheduled_at: string; message?: string }) =>
    api.post('/bookings', data),
  getMyBookings: (params?: { status?: string; limit?: number; skip?: number }) =>
    api.get('/bookings/my', { params }),
  getBookingDetail: (bookingId: string) => api.get(`/bookings/${bookingId}`),
  cancelBooking: (bookingId: string, reason?: string) =>
    api.put(`/bookings/${bookingId}/cancel`, null, { params: { reason } }),
  submitReview: (bookingId: string, rating: number, comment?: string) =>
    api.post(`/bookings/${bookingId}/review`, null, { params: { rating, comment } }),
    
  // Reviews management
  getProReviews: (proId: string, params?: { rating_filter?: number; sort_by?: string; limit?: number; skip?: number }) =>
    api.get(`/pros/${proId}/reviews`, { params }),
  getMyReviews: (params?: { has_response?: boolean; rating_filter?: number; limit?: number; skip?: number }) =>
    api.get('/pro/dashboard/reviews', { params }),
  respondToReview: (reviewId: string, responseText: string) =>
    api.post(`/pro/dashboard/reviews/${reviewId}/respond`, { response_text: responseText }),
  updateReviewResponse: (reviewId: string, responseText: string) =>
    api.put(`/pro/dashboard/reviews/${reviewId}/respond`, { response_text: responseText }),
    
  // Payments
  createBookingPayment: (bookingId: string, originUrl: string) =>
    api.post('/bookings/checkout', { booking_id: bookingId, origin_url: originUrl }),
  getBookingPaymentStatus: (sessionId: string) =>
    api.get(`/bookings/payment-status/${sessionId}`),
    
  // Earnings
  getEarnings: () => api.get('/pro/earnings'),
  requestPayout: () => api.post('/pro/request-payout'),
  getAdvancedStats: () => api.get('/pro/advanced-stats'),
  
  // Courses
  getCourses: () => api.get('/pro/courses'),
  getCourse: (courseId: string) => api.get(`/pro/courses/${courseId}`),
  createCourse: (data: any) => api.post('/pro/courses', data),
  updateCourse: (courseId: string, data: any) => api.put(`/pro/courses/${courseId}`, data),
  deleteCourse: (courseId: string) => api.delete(`/pro/courses/${courseId}`),
  
  // Modules
  createModule: (courseId: string, data: any) => api.post(`/pro/courses/${courseId}/modules`, data),
  updateModule: (moduleId: string, data: any) => api.put(`/pro/modules/${moduleId}`, data),
  deleteModule: (moduleId: string) => api.delete(`/pro/modules/${moduleId}`),
  
  // Lessons
  createLesson: (moduleId: string, data: any) => api.post(`/pro/modules/${moduleId}/lessons`, data),
  updateLesson: (lessonId: string, data: any) => api.put(`/pro/lessons/${lessonId}`, data),
  deleteLesson: (lessonId: string) => api.delete(`/pro/lessons/${lessonId}`),
  
  // Quizzes
  createQuiz: (moduleId: string, data: any) => api.post(`/pro/modules/${moduleId}/quiz`, data),
  deleteQuiz: (moduleId: string) => api.delete(`/pro/modules/${moduleId}/quiz`),
  
  // Video Sessions
  getVideoSessions: () => api.get('/pro/video-sessions'),
  createVideoSession: (data: any) => api.post('/pro/video-sessions', data),
  updateVideoSession: (sessionId: string, data: any) => api.put(`/pro/video-sessions/${sessionId}`, data),
  deleteVideoSession: (sessionId: string) => api.delete(`/pro/video-sessions/${sessionId}`),
  
  // Documents
  getDocuments: (courseId?: string) => api.get('/pro/documents', { params: { course_id: courseId } }),
  deleteDocument: (documentId: string) => api.delete(`/pro/documents/${documentId}`),
  
  // Live Sessions
  getLiveSessions: (status?: string) => api.get('/pro/live-sessions', { params: { status } }),
  createLiveSession: (data: any) => api.post('/pro/live-sessions', data),
  startLiveSession: (sessionId: string) => api.put(`/pro/live-sessions/${sessionId}/start`),
  endLiveSession: (sessionId: string) => api.put(`/pro/live-sessions/${sessionId}/end`),
  
  // Course Statistics
  getCourseStatistics: () => api.get('/pro/courses/statistics'),
  
  // Service Resources
  getServiceResources: (serviceId: string) => api.get(`/pro/services/${serviceId}/resources`),
  addServiceResource: (serviceId: string, data: { resource_type: string; title: string; description?: string; content?: string; file_url?: string }) => 
    api.post(`/pro/services/${serviceId}/resources`, data),
  deleteServiceResource: (serviceId: string, resourceId: string) => 
    api.delete(`/pro/services/${serviceId}/resources/${resourceId}`),
  
  // Analytics & Statistics
  getRevenueAnalytics: (period: string = '30d') => api.get('/pro/analytics/revenue', { params: { period } }),
  getPerformanceAnalytics: () => api.get('/pro/analytics/performance'),
  
  // Export Data
  exportBookings: (format: string = 'csv', startDate?: string, endDate?: string) => 
    api.get('/pro/export/bookings', { params: { format, start_date: startDate, end_date: endDate } }),
  exportRevenue: (year?: number) => api.get('/pro/export/revenue', { params: { year } }),
  exportRevenuePDF: (year?: number) => api.get('/pro/export/revenue/pdf', { params: { year } }),
  
  // ==========================================
  // TOTAL FLEXIBILITY SYSTEM
  // ==========================================
  
  // Content Library
  getContentLibrary: () => api.get('/pro/content-library'),
  getContentItem: (contentId: string) => api.get(`/pro/content-library/${contentId}`),
  createContentItem: (data: {
    content_type: 'pdf' | 'video' | 'quiz' | 'audio' | 'text' | 'checklist';
    title: string;
    description?: string;
    content_data?: any;
    file_url?: string;
    video_url?: string;
    thumbnail_url?: string;
    duration_minutes?: number;
    tags?: string[];
    is_premium?: boolean;
  }) => api.post('/pro/content-library', data),
  updateContentItem: (contentId: string, data: any) => api.put(`/pro/content-library/${contentId}`, data),
  deleteContentItem: (contentId: string) => api.delete(`/pro/content-library/${contentId}`),
  
  // Offers
  getOffers: () => api.get('/pro/offers'),
  getOffer: (offerId: string) => api.get(`/pro/offers/${offerId}`),
  createOffer: (data: {
    offer_type: 'bundle' | 'single_content' | 'subscription' | 'service_package' | 'coaching_pack' | 'custom';
    title: string;
    description?: string;
    short_description?: string;
    price: number;
    pricing_model?: 'one_time' | 'subscription' | 'pay_what_you_want' | 'installments';
    subscription_interval?: 'monthly' | 'quarterly' | 'yearly';
    included_content_ids?: string[];
    included_service_ids?: string[];
    included_course_ids?: string[];
    access_duration_days?: number;
    max_participants?: number;
    category?: string;
    difficulty?: string;
    tags?: string[];
    is_published?: boolean;
  }) => api.post('/pro/offers', data),
  updateOffer: (offerId: string, data: any) => api.put(`/pro/offers/${offerId}`, data),
  deleteOffer: (offerId: string) => api.delete(`/pro/offers/${offerId}`),
  publishOffer: (offerId: string) => api.put(`/pro/offers/${offerId}/publish`),
  unpublishOffer: (offerId: string) => api.put(`/pro/offers/${offerId}/publish`),
  
  // Bundles (Quick grouping)
  getBundles: () => api.get('/pro/bundles'),
  createBundle: (data: { name: string; item_ids: string[] }) => api.post('/pro/bundles', data),
  updateBundle: (bundleId: string, data: any) => api.put(`/pro/bundles/${bundleId}`, data),
  deleteBundle: (bundleId: string) => api.delete(`/pro/bundles/${bundleId}`),
};

// Marketplace API (Public)
export const marketplaceAPI = {
  getOffers: (params?: { category?: string; difficulty?: string; search?: string; min_price?: number; max_price?: number; limit?: number; skip?: number }) =>
    api.get('/marketplace/offers', { params }),
  getOffer: (offerId: string) => api.get(`/marketplace/offers/${offerId}`),
  purchaseOffer: (offerId: string) => api.post(`/marketplace/offers/${offerId}/purchase`),
  getMyPurchases: () => api.get('/marketplace/purchases'),
  getPurchasedContent: (purchaseId: string) => api.get(`/marketplace/purchases/${purchaseId}/content`),
};

// Student Course API
export const courseAPI = {
  // Browse courses
  browseCourses: (params?: { category?: string; difficulty?: string; search?: string; limit?: number; skip?: number }) =>
    api.get('/courses', { params }),
  getCoursePublic: (courseId: string) => api.get(`/courses/${courseId}`),
  getCourseReviews: (courseId: string, params?: { limit?: number; skip?: number }) =>
    api.get(`/courses/${courseId}/reviews`, { params }),
  
  // Enrollment
  enrollInCourse: (courseId: string, paymentType: string = 'single') =>
    api.post(`/courses/${courseId}/enroll`, { course_id: courseId, payment_type: paymentType }),
  confirmEnrollment: (enrollmentId: string) =>
    api.post(`/courses/enrollment/${enrollmentId}/confirm`),
  getMyEnrollments: (status?: string) =>
    api.get('/courses/my-enrollments', { params: { status } }),
  
  // Learning
  getCourseContent: (courseId: string) => api.get(`/courses/${courseId}/learn`),
  markLessonComplete: (courseId: string, lessonId: string) =>
    api.post(`/courses/${courseId}/lessons/${lessonId}/complete`),
  submitQuiz: (courseId: string, moduleId: string, answers: any[]) =>
    api.post(`/courses/${courseId}/modules/${moduleId}/quiz/submit`, { answers }),
  getCertificate: (courseId: string) => api.get(`/courses/${courseId}/certificate`),
  getCertificatePDF: (courseId: string) => `${API_URL}/api/courses/${courseId}/certificate/pdf`,
  
  // Reviews
  submitReview: (courseId: string, rating: number, comment?: string) =>
    api.post(`/courses/${courseId}/reviews`, { rating, comment }),
  
  // Discussions
  getDiscussions: (courseId: string, params?: { module_id?: string; lesson_id?: string; limit?: number; skip?: number }) =>
    api.get(`/courses/${courseId}/discussions`, { params }),
  createDiscussion: (courseId: string, content: string, moduleId?: string, lessonId?: string, parentId?: string) =>
    api.post(`/courses/${courseId}/discussions`, 
      { content, parent_id: parentId },
      { params: { module_id: moduleId, lesson_id: lessonId } }
    ),
  
  // Live Sessions (Student)
  joinLiveSession: (sessionId: string) => api.post(`/live-sessions/${sessionId}/join`),
};

// Report API
export const reportAPI = {
  getReasons: () => api.get('/reports/reasons'),
  createReport: (data: {
    reported_user_id: string;
    reason: string;
    details?: string;
    context_type?: string;
    context_id?: string;
  }) => api.post('/reports', data),
};

// Admin Report API
export const adminReportAPI = {
  getReports: (params?: { status?: string; limit?: number; skip?: number }) =>
    api.get('/admin/reports', { params }),
  reviewReport: (reportId: string, newStatus: string, adminNotes?: string, banUser?: boolean) =>
    api.put(`/admin/reports/${reportId}/review`, null, { 
      params: { new_status: newStatus, admin_notes: adminNotes, ban_user: banUser }
    }),
  getStats: () => api.get('/admin/reports/stats'),
};

// Revenue API (Super Admin only)
export const revenueAPI = {
  getRevenue: (period?: string) => api.get('/admin/revenue', { params: { period } }),
  getWithdrawals: (status?: string) => api.get('/admin/withdrawals', { params: { status } }),
  processWithdrawal: (withdrawalId: string, action: string, adminNotes?: string) =>
    api.put(`/admin/withdrawals/${withdrawalId}/process`, null, {
      params: { action, admin_notes: adminNotes }
    }),
};

// Influencer / Affiliate APIs
export const influencerAPI = {
  // Admin
  createInfluencer: (data: { name: string; email: string; commission_rate?: number }) =>
    api.post('/influencers', data),
  listInfluencers: () => api.get('/admin/influencers'),
  updateInfluencer: (id: string, data: { name?: string; commission_rate?: number; status?: string }) =>
    api.put(`/influencers/${id}`, data),
  triggerPayout: (id: string, amount?: number) =>
    api.post(`/influencers/${id}/payout`, { amount }),
  listConversions: () => api.get('/admin/conversions'),
  // Influencer self
  getMyStats: () => api.get('/influencer/stats'),
  connectStripe: (return_url: string) =>
    api.post('/influencer/stripe/connect', { return_url }),
  getStripeStatus: () => api.get('/influencer/stripe/status'),
  // Tracking
  trackClick: (code: string) => api.post('/affiliate/click', { code }),
};

export default api;
