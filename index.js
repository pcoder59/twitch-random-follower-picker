const express = require('express');
const path = require('path');
const app = express();

const crypto = require('crypto');
const https = require('https');

const PORT = process.env.PORT || 3000;

const CLIENT_ID = "qs2r5mh97upfdwflse6gtmzmdrjum0"
const CLIENT_SECRET = "digowrehanuu5dag22akh8ep3xb5c0"

const REDIRECT_URI = "http://localhost:3000/callback"

var responseType = 'code';
var scope = 'moderator%3Aread%3Afollowers';

var state = generateRandomString(10);

function generateRandomString(length) {
    return crypto.randomBytes(length).toString('hex').slice(0, length);
}

async function getAuthenticatedUserId(bearerToken) {
    const url = 'https://api.twitch.tv/helix/users';

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${bearerToken}`,
            'Client-ID': CLIENT_ID, // Replace with your actual Client ID
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        return null;
    }

    const data = await response.json();
    // The response contains an array of user objects
    if (data.data && data.data.length > 0) {
        // Return the user ID of the authenticated user
        return data.data[0].id;
    } else {
        return null;
    }
}

async function getUserFollows(bearerToken, userId) {
    const url = `https://api.twitch.tv/helix/channels/followers?broadcaster_id	=${userId}`;

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${bearerToken}`,
            'Client-ID': CLIENT_ID, // Replace with your actual Client ID
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        return null;
    }

    // Read the response body as a text
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let result = '';
    
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += decoder.decode(value, { stream: true });
    }
    
    return JSON.parse(result);
}

function getRandomIndex(array) {
    // Check if the array is empty
    if (array.length === 0) {
        return null;
    }
    
    // Generate a random index
    const randomIndex = Math.floor(Math.random() * array.length);
    
    return randomIndex;
}

// Set up EJS as the templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Define a route for the root URL
app.get('/', (req, res) => {
    const data = {
        pageTitle: 'Welcome to Twitch Random Follower Picker',
        responseType: responseType,
        clientId: CLIENT_ID,
        redirectUri: REDIRECT_URI,
        scopeSend: scope,
        stateSend: state
    };
    res.render('index', data);
});

// Define a route for the /about URL
app.get('/callback', (req, res) => {
    if (req.query.error) {
        const data = {
            pageTitle: 'Error',
            error: true
        };
        res.render('follower', data);
    }
    else if (state != req.query.state) {
        const data = {
            pageTitle: 'Error',
            error: true
        };
        res.render('follower', data);
    }
    else {
        var code = req.query.code;
        if (code) {
            const postData = JSON.stringify({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: REDIRECT_URI
            });

            // URL of the server where you want to send the POST request
            const targetUrl = 'https://id.twitch.tv/oauth2/token';
            const url = new URL(targetUrl);

            // Options for the POST request
            const options = {
                method: 'POST',
                hostname: url.hostname,
                port: url.port,
                path: url.pathname,
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData),
                },
            };

            // Create the request
            const request = https.request(options, (response) => {
                let resp = '';

                response.on('data', (chunk) => {
                    resp += chunk;
                });

                response.on('end', () => {
                    var tokenDetails = JSON.parse(resp)
                    if (tokenDetails.access_token) {
                        getAuthenticatedUserId(tokenDetails.access_token).then(userId => {
                            if (userId) {
                                getUserFollows(tokenDetails.access_token, userId).then(followers => {
                                    if (followers) {
                                        if (followers.total > 0) {
                                            var all_followers = followers.data;
                                            var random_index = getRandomIndex(all_followers);
                                            var picked_follower = all_followers[random_index].user_name;
                                            const data = {
                                                pageTitle: "Picked Follower",
                                                error: false,
                                                follower: picked_follower
                                            }
                                            res.render('follower', data);
                                        } else {
                                            const data = {
                                                pageTitle: 'Error',
                                                error: true
                                            };
                                            res.render('follower', data);
                                        }
                                    } else {
                                        const data = {
                                            pageTitle: 'Error',
                                            error: true
                                        };
                                        res.render('follower', data);
                                    }
                                }).catch(err => {
                                    const data = {
                                        pageTitle: 'Error',
                                        error: true
                                    };
                                    res.render('follower', data);
                                });
                            } else {
                                const data = {
                                    pageTitle: 'Error',
                                    error: true
                                };
                                res.render('follower', data);
                            }
                        }).catch(err => {
                            const data = {
                                pageTitle: 'Error',
                                error: true
                            };
                            res.render('follower', data);
                        });
                    } else {
                        const data = {
                            pageTitle: 'Error',
                            error: true
                        };
                        res.render('follower', data);
                    }
                });
            });

            request.on('error', (error) => {
                // Handle errors
                const data = {
                    pageTitle: 'Error',
                    error: true
                };
                res.render('follower', data);
            });

            request.write(postData);
            request.end();
        }
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
