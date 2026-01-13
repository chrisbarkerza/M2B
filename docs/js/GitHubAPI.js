/**
 * GitHubAPI - GitHub API wrapper
 * Handles all GitHub API interactions with authentication
 * Dependencies: None
 */
class GitHubAPI {
    constructor(token, repo) {
        this.token = token;
        this.repo = repo;
        this.baseUrl = `https://api.github.com/repos/${repo}`;
    }

    async request(endpoint, method = 'GET', body = null, silent = false) {
        const headers = {
            'Authorization': `token ${this.token}`,
            'Accept': 'application/vnd.github.v3+json'
        };

        const options = { method, headers };
        if (body) {
            options.body = JSON.stringify(body);
            headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(`${this.baseUrl}${endpoint}`, options);
        if (!response.ok) {
            if (silent && response.status === 404) {
                return null;
            }
            throw new Error(`GitHub API error: ${response.statusText}`);
        }
        return response.json();
    }

    async getFile(path) {
        const data = await this.request(`/contents/${path}`);
        return atob(data.content); // Decode base64
    }

    async updateFile(path, content, message) {
        // Get current file to get SHA
        let sha;
        try {
            const current = await this.request(`/contents/${path}`);
            sha = current.sha;
        } catch (e) {
            // File doesn't exist, that's ok
        }

        return this.request(`/contents/${path}`, 'PUT', {
            message,
            content: btoa(content), // Encode to base64
            sha
        });
    }

    async deleteFile(path, message) {
        // Get current file to get SHA
        const current = await this.request(`/contents/${path}`);
        const sha = current.sha;

        return this.request(`/contents/${path}`, 'DELETE', {
            message,
            sha
        });
    }

    async createIssue(title, body) {
        return this.request('/issues', 'POST', {
            title,
            body,
            labels: ['capture']
        });
    }

    async getIssueComments(issueNumber) {
        return this.request(`/issues/${issueNumber}/comments`);
    }
}

// Expose globally
window.GitHubAPI = GitHubAPI;
