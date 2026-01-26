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
            // 1. Search for existing file in appDataFolder
            const listUrl = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='poke_save.json'`;
            const listResponse = await fetch(listUrl, {
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            });
            const listData = await listResponse.json();

            const fileId = listData.files.length > 0 ? listData.files[0].id : null;
            const metadata = {
                name: 'poke_save.json',
                parents: ['appDataFolder']
            };

            const contentBlob = new Blob([JSON.stringify(data)], { type: 'application/json' });
            const formData = new FormData();
            formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            formData.append('file', contentBlob);

            let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
            let method = 'POST';

            if (fileId) {
                url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`;
                method = 'PATCH';
            }

            const saveResponse = await fetch(url, {
                method: method,
                headers: { 'Authorization': `Bearer ${this.accessToken}` },
                body: formData
            });

            if (saveResponse.ok) {
                console.log('Game saved to Google Drive');
                return true;
            } else {
                console.error('Failed to save to Drive:', await saveResponse.json());
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
