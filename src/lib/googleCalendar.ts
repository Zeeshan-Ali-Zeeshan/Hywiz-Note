// Google Calendar API Service using @react-oauth/google
interface GoogleCalendarConfig {
  clientId: string;
}

class GoogleCalendarService {
  private isInitialized = false;
  private accessToken: string | null = null;

  async initialize(config: GoogleCalendarConfig): Promise<void> {
    console.log('GoogleCalendarService.initialize called');

    // Validate config
    if (!config.clientId || config.clientId === 'your_google_client_id_here') {
      console.warn('Google Calendar client ID not configured');
      return;
    }

    // Get access token and expiry from localStorage
    const token = localStorage.getItem('google_access_token');
    const expiry = localStorage.getItem('google_token_expiry');

    if (!token) {
      console.log('No access token found in localStorage');
      this.isInitialized = false;
      return;
    }

    // Check if token is expired
    if (this.isTokenExpired(expiry)) {
      console.log('Access token is expired');
      this.isInitialized = false;
      return;
    }

    // Validate token format
    if (!this.isValidTokenFormat(token)) {
      console.log('Invalid token format found in localStorage');
      this.isInitialized = false;
      return;
    }

    this.accessToken = token;
    this.isInitialized = true;
    console.log('GoogleCalendarService initialized successfully');
  }

  private isTokenExpired(expiryStr: string | null): boolean {
    if (!expiryStr) return true;
    const expiry = parseInt(expiryStr, 10);
    if (isNaN(expiry)) return true;
    // Buffer of 5 minutes to be safe
    return Date.now() > (expiry - 5 * 60 * 1000);
  }

  private isValidTokenFormat(token: string): boolean {
    // Google OAuth tokens are typically long strings (ya29...)
    return token.length > 20;
  }

  async signIn(): Promise<boolean> {
    // For @react-oauth/google, sign in is handled by the OAuth flow
    // We just need to check if we have a valid access token
    const token = localStorage.getItem('google_access_token');
    if (!token) {
      throw new Error('No access token found. Please authenticate with Google first.');
    }

    if (!this.isValidTokenFormat(token)) {
      localStorage.removeItem('google_access_token');
      throw new Error('Invalid access token found. Please re-authenticate with Google.');
    }

    this.accessToken = token;
    this.isInitialized = true;
    return true;
  }

  async signOut(): Promise<void> {
    // Clear the access token
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('google_token_expiry');
    localStorage.removeItem('google_calendar_connected');
    this.accessToken = null;
    this.isInitialized = false;
  }

  isSignedIn(): boolean {
    const token = localStorage.getItem('google_access_token');
    const expiry = localStorage.getItem('google_token_expiry');
    return !!token && this.isInitialized && !this.isTokenExpired(expiry);
  }

  isPersistentConnectionSet(): boolean {
    return localStorage.getItem('google_calendar_connected') === 'true';
  }

  private async makeGoogleCalendarRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    // Validate token before making request
    if (!this.isValidTokenFormat(this.accessToken)) {
      throw new Error('Invalid access token. Please re-authenticate with Google.');
    }

    const baseUrl = 'https://www.googleapis.com/calendar/v3';
    const url = `${baseUrl}${endpoint}`;

    console.log('Making Google Calendar API request to:', url);

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || response.statusText;

      // Handle specific authentication errors
      if (response.status === 401) {
        console.error('Authentication failed - token may be expired');
        localStorage.removeItem('google_access_token');
        localStorage.removeItem('google_token_expiry');
        this.accessToken = null;
        this.isInitialized = false;
        throw new Error('Authentication failed. Please re-authenticate with Google.');
      }

      throw new Error(`Google Calendar API error: ${errorMessage}`);
    }

    return response.json();
  }

  async createEvent(eventData: {
    summary: string;
    start: { dateTime: string; timeZone?: string };
    end: { dateTime: string; timeZone?: string };
    attendees?: Array<{ email: string }>;
  }): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Google Calendar not initialized');
    }

    try {
      // Build payload without location and description
      const payload: any = {
        summary: eventData.summary,
        start: eventData.start,
        end: eventData.end
      };
      if (eventData.attendees && eventData.attendees.length > 0) {
        payload.attendees = eventData.attendees;
      }
      console.log('Google Calendar event payload:', payload);
      const response = await this.makeGoogleCalendarRequest('/calendars/primary/events', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      console.log('Google Calendar event created successfully:', response);
      return response;
    } catch (error: any) {
      console.error('Failed to create Google Calendar event:', error);
      throw new Error(`Failed to create Google Calendar event: ${error}`);
    }
  }

  async listEvents(startDate: string, endDate: string): Promise<any[]> {
    console.log('GoogleCalendarService.listEvents called');
    console.log('isInitialized:', this.isInitialized);
    console.log('accessToken:', this.accessToken ? 'Present' : 'Not present');
    console.log('startDate:', startDate);
    console.log('endDate:', endDate);

    if (!this.isInitialized) {
      throw new Error('Google Calendar not initialized');
    }

    try {
      const params = new URLSearchParams({
        timeMin: startDate,
        timeMax: endDate,
        singleEvents: 'true',
        orderBy: 'startTime',
      });

      console.log('Making Google Calendar API request...');
      const response = await this.makeGoogleCalendarRequest(`/calendars/primary/events?${params}`);
      console.log('Google Calendar API response:', response);
      console.log('Events found:', response.items?.length || 0);

      return response.items || [];
    } catch (error) {
      console.error('Error in listEvents:', error);
      throw new Error(`Failed to fetch Google Calendar events: ${error}`);
    }
  }

  async updateEvent(eventId: string, eventData: any): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Google Calendar not initialized');
    }

    try {
      const response = await this.makeGoogleCalendarRequest(`/calendars/primary/events/${eventId}`, {
        method: 'PUT',
        body: JSON.stringify(eventData),
      });
      return response;
    } catch (error: any) {
      throw new Error(`Failed to update Google Calendar event: ${error}`);
    }
  }

  async deleteEvent(eventId: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Google Calendar not initialized');
    }

    try {
      await this.makeGoogleCalendarRequest(`/calendars/primary/events/${eventId}`, {
        method: 'DELETE',
      });
    } catch (error: any) {
      throw new Error(`Failed to delete Google Calendar event: ${error}`);
    }
  }

  // Method to refresh access token if needed
  async refreshAccessToken(): Promise<void> {
    // For @react-oauth/google, token refresh is handled automatically
    // But we can check if the current token is still valid
    const token = localStorage.getItem('google_access_token');
    if (token && this.isValidTokenFormat(token)) {
      this.accessToken = token;
    } else {
      localStorage.removeItem('google_access_token');
      this.accessToken = null;
      this.isInitialized = false;
      throw new Error('No valid access token found. Please re-authenticate.');
    }
  }

  // Method to check if credentials are configured
  isConfigured(): boolean {
    try {
      const config = getGoogleCalendarConfig();
      return !!(config.clientId && config.clientId !== 'your_google_client_id_here');
    } catch {
      return false;
    }
  }

  async getUserInfo(): Promise<{ email: string; name: string; picture: string }> {
    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user info');
      }

      return await response.json();
    } catch (error: any) {
      console.error('Error fetching user info:', error);
      throw error;
    }
  }
}

// Create a singleton instance
export const googleCalendarService = new GoogleCalendarService();

// Helper function to get environment variables
export const getGoogleCalendarConfig = (): GoogleCalendarConfig => {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  if (!clientId || clientId === 'your_google_client_id_here') {
    throw new Error(
      'Google Calendar credentials not configured. Please set VITE_GOOGLE_CLIENT_ID in your .env file. See GOOGLE_CALENDAR_SETUP.md for setup instructions.'
    );
  }

  return { clientId };
}; 