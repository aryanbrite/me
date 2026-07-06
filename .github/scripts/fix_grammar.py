import os
import re
import requests

def process_daily_html():
    file_path = "Daily.html"
    if not os.path.exists(file_path):
        file_path = "daily.html"
    if not os.path.exists(file_path):
        print("Daily.html not found!")
        return

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY not set!")
        return

    # FIX: We use the official Gemini REST API directly to avoid the deprecated Python SDK.
    # Note: The official API model names do not include the "google/" prefix.
    # If "gemma-4-31b-it" returns a 404 error in the logs, change this to "gemma-3-27b-it" or "gemini-1.5-flash"
    model_name = "gemma-4-31b-it" 
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"

    day_pattern = re.compile(r'(<!-- day start -->)(.*?)(<!-- day end -->)', re.DOTALL)

    def fix_grammar(match):
        prefix = match.group(1)
        body = match.group(2)
        suffix = match.group(3)
        
        # Skip if already fixed (checking both spellings just in case)
        if "<!-- grammer fixed -->" in body or "<!-- grammar fixed -->" in body:
            return match.group(0)
        
        # Extract only the content inside <div class="conday">
        conday_match = re.search(r'(<div class="conday">\s*)(.*?)(\s*</div>)', body, re.DOTALL)
        if not conday_match:
            return match.group(0)
            
        conday_content = conday_match.group(2)
        
        # The prompt instructs the AI exactly how you want it to behave
        prompt = (
            "You are a grammar and spelling assistant. Fix the grammar and spelling of the provided text. "
            "Do not rewrite heavily or change the meaning. Keep the original voice and casual tone. "
            "If you think a slight rephrase would be much more expressive of what the user is trying to say, you may rephrase certain parts. "
            "Keep all HTML tags (like <p>, <br>) exactly as they are. "
            "Return ONLY the corrected text with HTML tags, without any markdown formatting, code blocks, or extra explanations."
        )
        
        payload = {
            "contents": [{
                "parts": [{"text": prompt + "\n\nText to fix:\n" + conday_content}]
            }]
        }
        
        try:
            response = requests.post(url, json=payload)
            response.raise_for_status()
            result = response.json()
            
            # Extract the text from the official API response structure
            corrected_content = result['candidates'][0]['content']['parts'][0]['text'].strip()
            
            # Clean up markdown code blocks if the AI accidentally adds them
            if corrected_content.startswith("```html"):
                corrected_content = corrected_content[7:]
            if corrected_content.startswith("```"):
                corrected_content = corrected_content[3:]
            if corrected_content.endswith("```"):
                corrected_content = corrected_content[:-3]
            corrected_content = corrected_content.strip()
            
            # Reconstruct the body safely using string indices
            start_idx = conday_match.start(2)
            end_idx = conday_match.end(2)
            new_body = body[:start_idx] + corrected_content + body[end_idx:]
            
            # Add the comment right after <!-- day start -->
            new_prefix = prefix + " <!-- grammar fixed -->\n"
            
            return new_prefix + new_body + suffix
        except Exception as e:
            print(f"Error calling LLM: {e}")
            if 'response' in locals():
                print(f"Response text: {response.text}")
            return match.group(0) # Return original if AI fails

    # Process all day blocks
    new_content = day_pattern.sub(fix_grammar, content)
    
    # Save the updated file
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(new_content)
    print("Grammar fix completed.")

if __name__ == "__main__":
    process_daily_html()