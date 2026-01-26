/* global google */
/**
 * GoogleDriveSync handles OAuth2 authentication with Google Identity Services
 * and provides methods to save/load game data from the user's App Data folder in Google Drive.
 */
class GoogleDriveSync {
    constructor() {
        this.tokenClient = null;
        this.accessToken = null;
        this.CLIENT_ID = '399269636124-vcdqnrh651m45qd8ihuka8igma5a8r51.apps.googleusercontent.com'; // User must replace this
        this.SCOPES = 'https://www.googleapis.com/auth/drive.appdata';
        this.DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
        this.isInitialized = false;
        this.onUserAuthenticated = null;
    }

    async init() {
        if (this.isInitialized) return;

        return new Promise((resolve) => {
            google.accounts.oauth2.initTokenClient({
                client_id: this.CLIENT_ID,
                scope: this.SCOPES,
                callback: (response) => {
                    if (response.error !== undefined) {
                        throw (response);
                    }
                    this.accessToken = response.access_token;
                    if (this.onUserAuthenticated) this.onUserAuthenticated();
                    resolve();
                },
            });
            this.isInitialized = true;
            console.log('Google Identity Services initialized');
        });
    }

    signIn() {
        if (!window.google) {
            alert('Google Identity Services not loaded yet. Please wait.');
            return;
        }

        // Initialize if not done
        google.accounts.oauth2.initTokenClient({
            client_id: this.CLIENT_ID,
            scope: this.SCOPES,
            callback: (response) => {
                if (response.error !== undefined) {
                    console.error('Google Auth Error:', response);
                    return;
                }
                this.accessToken = response.access_token;
                console.log('User signed in successfully');
                if (this.onUserAuthenticated) this.onUserAuthenticated();
            },
        }).requestAccessToken({ prompt: 'consent' });
    }

    async saveToDrive(data) {
        if (!this.accessToken) {
            console.warn('Cannot save to Drive: User not signed in');
            return;
        }

        try {
            // 1. Search for existing file
            const listUrl = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='poke_save.json'`;
            const listResponse = await fetch(listUrl, {
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            });
            const listData = await listResponse.json();
            const fileId = listData.files.length > 0 ? listData.files[0].id : null;

            // 2. Prepare Multipart Body
            const boundary = '-------314159265358979323846';
            const delimiter = "\r\n--" + boundary + "\r\n";
            const close_delim = "\r\n--" + boundary + "--";

            const metadata = {
                name: 'poke_save.json',
                mimeType: 'application/json',
                parents: fileId ? [] : ['appDataFolder'] // Only needed for initial POST
            };

            const multipartRequestBody =
                delimiter +
                'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
                JSON.stringify(metadata) +
                delimiter +
                'Content-Type: application/json\r\n\r\n' +
                JSON.stringify(data) +
                close_delim;

            let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
            let method = 'POST';

            if (fileId) {
                url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`;
                method = 'PATCH';
            }

            const saveResponse = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': `multipart/related; boundary=${boundary}`
                },
                body: multipartRequestBody
            });

            if (saveResponse.ok) {
                console.log('Game saved to Google Drive');
                return true;
            } else {
                const err = await saveResponse.json();
                console.error('Failed to save to Drive:', err);
                if (err.error && err.error.message) {
                    showDialog(`Sync Error: ${err.error.message}`, 3000);
                }
            }
        } catch (error) {
            console.error('Error saving to Drive:', error);
        }
        return false;
    }

    async loadFromDrive() {
        if (!this.accessToken) {
            console.warn('Cannot load from Drive: User not signed in');
            return null;
        }

        try {
            // 1. Search for existing file in appDataFolder
            const listUrl = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='poke_save.json'`;
            const listResponse = await fetch(listUrl, {
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            });
            const listData = await listResponse.json();

            if (listData.files.length === 0) {
                console.log('No save file found in Google Drive');
                return null;
            }

            const fileId = listData.files[0].id;
            const fileUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
            const fileResponse = await fetch(fileUrl, {
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            });

            if (fileResponse.ok) {
                const data = await fileResponse.json();
                console.log('Game loaded from Google Drive');
                return data;
            } else {
                console.error('Failed to load from Drive:', await fileResponse.json());
            }
        } catch (error) {
            console.error('Error loading from Drive:', error);
        }
        return null;
    }
}

const gdSync = new GoogleDriveSync();
console.log('google-drive.js loaded');
