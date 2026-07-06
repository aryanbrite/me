const fs = require('fs');

async function processDailyHtml() {
    const filePath = fs.existsSync('Daily.html') ? 'Daily.html' : 'daily.html';
    if (!fs.existsSync(filePath)) {
        console.log("Daily.html not found!");
        return;
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        console.log("OPENROUTER_API_KEY not set!");
        return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    
    // Regex to find each day block
    const dayRegex = /(<!-- day start -->)([\s\S]*?)(<!-- day end -->)/g;
    let matches = [...content.matchAll(dayRegex)];

    // Filter out days that are already fixed
    const unfixedBlocks = matches.filter(match => {
        const body = match[2];
        return !body.includes('<!-- grammer fixed -->') && !body.includes('<!-- grammar fixed -->');
    });

    if (unfixedBlocks.length === 0) {
        console.log("All days already have fixed grammar. Nothing to do.");
        return;
    }

    console.log(`Found ${unfixedBlocks.length} unfixed days. Batching them into a single API call...`);

    // Extract the text inside <div class="conday"> for all unfixed blocks
    const entriesToFix = [];
    for (const match of unfixedBlocks) {
        const body = match[2];
        const condayMatch = body.match(/(<div class="conday">\s*)([\s\S]*?)(\s*<\/div>)/);
        if (condayMatch) {
            entriesToFix.push(condayMatch[2]);
        }
    }

    // We use a unique delimiter so the AI knows how to separate the answers
    const DELIMITER = '===SPLIT_8f7e6d5c===';
    
    const url = `https://openrouter.ai/api/v1/chat/completions`;

    try {
        // Native fetch is built into modern Node.js
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://github.com/aryanbrite/me', // Optional but recommended by OpenRouter
                'X-Title': 'Aryan Brite Grammar Fix'
            },
            body: JSON.stringify({
                model: "openrouter/free",
                // FIX: Separating "system" and "user" roles prevents the model from echoing the prompt
                messages: [
                    {
                        role: "system",
                        content: "You are a grammar and spelling assistant. Fix the grammar and spelling of the provided text. Do not rewrite heavily or change the meaning. Keep the original casual voice. If a slight rephrase makes it much more expressive, you may rephrase certain parts. Keep all HTML tags (like <p>, <br>) exactly as they are. Return ONLY the corrected entries, separated EXACTLY by the delimiter. Do not include any markdown formatting, code blocks, extra text, or repeat the instructions."
                    },
                    {
                        role: "user",
                        content: `Entries:\n${entriesToFix.join('\n' + DELIMITER + '\n')}`
                    }
                ]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        let responseText = result.choices[0].message.content.trim();

        // Clean up markdown just in case the AI ignores the prompt
        responseText = responseText.replace(/^```html\n?/i, '').replace(/^```\n?/, '').replace(/\n?```$/, '').trim();

        // Split the AI's response back into individual entries
        const fixedEntries = responseText.split(DELIMITER).map(s => s.trim());

        if (fixedEntries.length !== entriesToFix.length) {
            console.warn(`Warning: AI returned ${fixedEntries.length} entries, but we sent ${entriesToFix.length}. Proceeding carefully...`);
        }

        // Reconstruct the HTML
        let newContent = content;
        let fixIndex = 0;

        for (const match of unfixedBlocks) {
            if (fixIndex >= fixedEntries.length) break; // Safety check
            
            const originalBlock = match[0];
            const prefix = match[1];
            const body = match[2];
            const suffix = match[3];

            const condayMatch = body.match(/(<div class="conday">\s*)([\s\S]*?)(\s*<\/div>)/);
            if (condayMatch) {
                // Replace the old text with the new fixed text
                const newBody = body.replace(condayMatch[2], fixedEntries[fixIndex]);
                
                // Add the grammar fixed comment
                const newPrefix = prefix + " <!-- grammar fixed -->\n";
                const newBlock = newPrefix + newBody + suffix;

                // Replace in the main content
                newContent = newContent.replace(originalBlock, newBlock);
                fixIndex++;
            }
        }

        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`Successfully fixed ${fixIndex} days in a single API call!`);

    } catch (error) {
        console.error("Error calling LLM:", error.message);
    }
}

processDailyHtml();