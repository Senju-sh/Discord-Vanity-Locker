async function startProcess() {
    console.clear();
    let data = {};
    let step = 1;

    while (step <= 3) {
        switch (step) {
            case 1:
                data.token = await promptUser(`Token : `);
                const userDataResponse = await fetchUserData(data.token);
                
                if (userDataResponse.ok) {
                    const userData = await userDataResponse.json();
                    data.name = userData.username;
                } else {
                    handleError("INVALID", data.token);
                    process.exit();
                }
                break;

            case 2:
                data.guild = await promptUser(`Guild ID : `);
                const guildDataResponse = await fetchGuildData(data.guild, data.token);

                if (!guildDataResponse.ok) {
                    handleError("INVALID", data.guild);
                    process.exit();
                }
                break;

            case 3:
                data.vanity = await promptUser(`Vanity URL : `);
                break;
        }
        step++;
    }

    console.clear();
    logData("TOKEN", maskToken(data.token));
    logData("USER", data.name);
    logData("GUILD", data.guild);
    logData("VANITY", data.vanity);

    await updateVanityURL(data.guild, data.vanity, data.token);
}

function promptUser(question) {
    return new Promise((resolve) => {
        process.stdout.write(question);
        process.stdin.once('data', (input) => {
            resolve(input.toString().trim());
        });
    });
}

function logData(label, value) {
    console.log(`${getCurrentTime()} \x1b[32m[${label}]\x1b[90m - \x1b[36m${value}\x1b[0m`);
}

function handleError(label, value) {
    console.log(`${getCurrentTime()} \x1b[31m[${label}]\x1b[90m - \x1b[36m${value}\x1b[0m`);
}

function getCurrentTime() {
    return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function maskToken(token) {
    return token.replace(/^(.*?)\..*$/, (_, match) => match + 'x'.repeat(token.length - match.length));
}

async function fetchUserData(token) {
    return fetch(`https://discord.com/api/v9/users/@me`, {
        headers: { Authorization: `${token}` }
    });
}

async function fetchGuildData(guildId, token) {
    return fetch(`https://discord.com/api/v9/guilds/${guildId}`, {
        headers: { Authorization: `${token}` }
    });
}

async function updateVanityURL(guildId, vanityCode, token) {
    let attempts = 0;

    while (true) {
        attempts++;

        const response = await fetch(`https://discord.com/api/v9/guilds/${guildId}/vanity-url`, {
            method: 'PATCH',
            headers: {
                Authorization: `${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code: vanityCode })
        });

        if (response.ok) {
            continue;
        }

        if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('Retry-After'), 10);

            if (!isNaN(retryAfter)) {
                const hours = Math.floor(retryAfter / 3600);
                const minutes = Math.floor((retryAfter % 3600) / 60);

                handleError("RATELIMIT", `Rate limited the vanity ${vanityCode} for ${hours} hours and ${minutes} minutes. (${attempts - 1})`);
                handleError("RATELIMIT", `Retrying in ${hours} hours and ${minutes} minutes...`);

                attempts = 0;
                await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                continue;
            } else {
                return;
            }
        }

        handleError("VANITY", `Failed to set Vanity URL (${response.statusText})`);
        process.exit(1);
    }
}

startProcess();