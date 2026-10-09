import asyncio
import os
import subprocess
from playwright.async_api import async_playwright

async def render():
    target_dir = os.path.dirname(os.path.abspath(__file__))
    output_mp4 = os.path.join(target_dir, "explainer_preview.mp4")
    temp_dir = os.path.join(target_dir, ".video_temp")
    os.makedirs(temp_dir, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            record_video_dir=temp_dir,
            record_video_size={"width": 1920, "height": 1080}
        )
        page = await context.new_page()

        file_path = "file://" + os.path.join(target_dir, "index.html")
        print(f"Loading {file_path} for programmatic video render...")
        await page.goto(file_path, wait_until="networkidle")
        await page.wait_for_timeout(1000)

        # 1. Hero view
        await page.wait_for_timeout(2000)

        # 2. Scroll to Module 3 (Lloyd Interactive Simulator)
        m3 = page.locator("#module3")
        if await m3.count() > 0:
            await m3.scroll_into_view_if_needed()
            await page.wait_for_timeout(1000)
            step_btn = page.locator("#stepBtn")
            for _ in range(6):
                if await step_btn.count() > 0:
                    await step_btn.click()
                await page.wait_for_timeout(500)

        # 3. Change K slider
        k_slider = page.locator("#kSlider")
        if await k_slider.count() > 0:
            await k_slider.evaluate("el => { el.value = '4'; el.dispatchEvent(new Event('input')); }")
            await page.wait_for_timeout(1000)
            step_btn = page.locator("#stepBtn")
            for _ in range(4):
                if await step_btn.count() > 0:
                    await step_btn.click()
                await page.wait_for_timeout(500)

        # 4. Scroll to Module 4 (Elbow & Silhouette)
        m4 = page.locator("#module4")
        if await m4.count() > 0:
            await m4.scroll_into_view_if_needed()
            await page.wait_for_timeout(1500)

        await context.close()
        await browser.close()

    video_files = [os.path.join(temp_dir, f) for f in os.listdir(temp_dir) if f.endswith(".webm")]
    if not video_files:
        raise RuntimeError("No recorded video found in temp dir")

    recorded_webm = video_files[0]
    print(f"Recorded webm: {recorded_webm}, transcoding to MP4 via ffmpeg...")

    cmd = [
        "/opt/homebrew/bin/ffmpeg", "-y",
        "-i", recorded_webm,
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-crf", "18",
        "-preset", "fast",
        "-movflags", "+faststart",
        output_mp4
    ]
    subprocess.run(cmd, check=True)

    for f in os.listdir(temp_dir):
        os.remove(os.path.join(temp_dir, f))
    os.rmdir(temp_dir)

    print(f"Successfully generated: {output_mp4}")

if __name__ == "__main__":
    asyncio.run(render())
