/**
 * Rate Limiter Service
 * Prevents spam/DoS attacks by tracking request attempts per IP
 * Implements sliding window rate limiting
 */

class RateLimiterService {
    constructor() {
        // Store attempts by IP: { ip: [timestamps] }
        this.attempts = new Map();
        // Store blocked IPs: { ip: unblockTime }
        this.blockedIPs = new Map();

        // Configuration
        this.config = {
            maxAttempts: 100,        // Max attempts allowed
            windowSeconds: 60,        // Time window in seconds
            blockDurationMinutes: 15, // How long to block the IP
        };

        // Cleanup old entries every 5 minutes
        this.startCleanup();
    }

    /**
     * Check if an IP is rate limited
     * @param {string} ipAddress - The IP address to check
     * @returns {Object} { allowed: boolean, retryAfter?: number }
     */
    checkRateLimit(ipAddress) {
        const now = Date.now();

        // Check if IP is blocked
        if (this.blockedIPs.has(ipAddress)) {
            const unblockTime = this.blockedIPs.get(ipAddress);
            if (now < unblockTime) {
                const retryAfter = Math.ceil((unblockTime - now) / 1000);
                return { allowed: false, retryAfter, reason: 'IP_BLOCKED' };
            } else {
                // Unblock expired IP
                this.blockedIPs.delete(ipAddress);
                this.attempts.delete(ipAddress);
            }
        }

        // Get or initialize attempts for this IP
        let ipAttempts = this.attempts.get(ipAddress) || [];

        // Remove attempts outside the time window
        const windowStart = now - (this.config.windowSeconds * 1000);
        ipAttempts = ipAttempts.filter(timestamp => timestamp > windowStart);

        // Check if exceeded limit
        if (ipAttempts.length >= this.config.maxAttempts) {
            // Block the IP
            const blockDuration = this.config.blockDurationMinutes * 60 * 1000;
            const unblockTime = now + blockDuration;
            this.blockedIPs.set(ipAddress, unblockTime);

            // Clear attempts (will start fresh after unblock)
            this.attempts.delete(ipAddress);

            return {
                allowed: false,
                retryAfter: this.config.blockDurationMinutes * 60,
                reason: 'RATE_LIMIT_EXCEEDED'
            };
        }

        // Record this attempt
        ipAttempts.push(now);
        this.attempts.set(ipAddress, ipAttempts);

        return { allowed: true };
    }

    /**
     * Get the client's IP address
     * Note: In React Native, you'll need to implement this based on your backend
     * This is a placeholder that would work with your backend API
     * @returns {Promise<string>} The IP address
     */
    async getClientIP() {
        try {
            // In a real implementation, you would:
            // 1. Call your backend API endpoint that returns the client IP
            // 2. Or use a service like ipify API
            // Example: const response = await fetch('https://api.ipify.org?format=json');

            // For now, return a placeholder that your backend should replace
            // Your backend should track the real IP from the request headers
            return 'client-ip'; // This will be replaced by backend
        } catch (error) {
            console.error('Error getting client IP:', error);
            return 'unknown';
        }
    }

    /**
     * Reset rate limit for an IP (used after successful login)
     * @param {string} ipAddress - The IP address to reset
     */
    resetRateLimit(ipAddress) {
        this.attempts.delete(ipAddress);
    }

    /**
     * Manually unblock an IP (admin function)
     * @param {string} ipAddress - The IP address to unblock
     */
    unblockIP(ipAddress) {
        this.blockedIPs.delete(ipAddress);
        this.attempts.delete(ipAddress);
    }

    /**
     * Get current status for an IP
     * @param {string} ipAddress - The IP address to check
     * @returns {Object} Status information
     */
    getIPStatus(ipAddress) {
        const now = Date.now();

        if (this.blockedIPs.has(ipAddress)) {
            const unblockTime = this.blockedIPs.get(ipAddress);
            if (now < unblockTime) {
                return {
                    blocked: true,
                    unblockTime,
                    secondsRemaining: Math.ceil((unblockTime - now) / 1000)
                };
            }
        }

        const ipAttempts = this.attempts.get(ipAddress) || [];
        const windowStart = now - (this.config.windowSeconds * 1000);
        const recentAttempts = ipAttempts.filter(timestamp => timestamp > windowStart);

        return {
            blocked: false,
            attemptCount: recentAttempts.length,
            maxAttempts: this.config.maxAttempts,
            remainingAttempts: this.config.maxAttempts - recentAttempts.length
        };
    }

    /**
     * Cleanup old entries periodically
     */
    startCleanup() {
        setInterval(() => {
            const now = Date.now();

            // Clean up expired blocked IPs
            for (const [ip, unblockTime] of this.blockedIPs.entries()) {
                if (now >= unblockTime) {
                    this.blockedIPs.delete(ip);
                }
            }

            // Clean up old attempts
            const windowStart = now - (this.config.windowSeconds * 1000);
            for (const [ip, timestamps] of this.attempts.entries()) {
                const recentAttempts = timestamps.filter(timestamp => timestamp > windowStart);
                if (recentAttempts.length === 0) {
                    this.attempts.delete(ip);
                } else {
                    this.attempts.set(ip, recentAttempts);
                }
            }
        }, 5 * 60 * 1000); // Run every 5 minutes
    }

    /**
     * Update configuration
     * @param {Object} newConfig - New configuration values
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
}

// Export singleton instance
const rateLimiterService = new RateLimiterService();
export default rateLimiterService;
