import asyncio
import os
import sys
from playwright.async_api import async_playwright

async def run_tests():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1440, "height": 900})
        page = await context.new_page()

        console_errors = []
        page_errors = []

        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda err: page_errors.append(str(err)))

        html_path = "file://" + os.path.abspath("index.html")
        print(f"Loading {html_path}...")
        await page.goto(html_path, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(2500)

        print(f"Console errors on load: {len(console_errors)} -> {console_errors}")
        print(f"Page errors on load: {len(page_errors)} -> {page_errors}")

        # Assert no errors on initial load
        assert len(console_errors) == 0, f"Unexpected console errors: {console_errors}"
        assert len(page_errors) == 0, f"Unexpected page errors: {page_errors}"

        # 1. Test Canvas existence
        canvas = page.locator("#kmeansCanvas")
        assert await canvas.is_visible(), "Canvas should be visible"

        # 2. Test Step button click
        print("Testing Step button...")
        step_btn = page.locator("#stepBtn")
        await step_btn.click()
        await page.wait_for_timeout(500)
        phase_text = await page.locator("#phaseText").inner_text()
        print(f"Phase after step 1: {phase_text}")

        # Click step again to update centroids
        await step_btn.click()
        await page.wait_for_timeout(500)
        iteration_count = await page.locator("#iterationCountVal").inner_text()
        print(f"Iteration after step 2: {iteration_count}")
        assert int(iteration_count) >= 1

        # 3. Test Slider K
        print("Testing K Slider change...")
        k_slider = page.locator("#kSlider")
        await k_slider.evaluate("el => { el.value = '4'; el.dispatchEvent(new Event('input')); }")
        await page.wait_for_timeout(500)
        k_val = await page.locator("#kValBadge").inner_text()
        print(f"K value badge: {k_val}")
        assert k_val == "4"

        # 4. Test Quiz click
        print("Testing Quiz interaction...")
        q1_correct_opt = page.locator('.quiz-item[data-qid="1"] .quiz-option[data-correct="true"]')
        await q1_correct_opt.click()
        await page.wait_for_timeout(300)
        score_text = await page.locator("#quizScoreText").inner_text()
        print(f"Quiz score after Q1: {score_text}")
        assert "1 / 4" in score_text

        # Answer remaining questions
        for qid in ["2", "3", "4"]:
            opt = page.locator(f'.quiz-item[data-qid="{qid}"] .quiz-option[data-correct="true"]')
            await opt.click()
            await page.wait_for_timeout(200)

        final_score = await page.locator("#quizScoreText").inner_text()
        print(f"Final quiz score: {final_score}")
        assert "4 / 4" in final_score

        # 5. Take screenshot
        await page.screenshot(path="screenshot_verified.png", full_page=True)
        print("Screenshot saved to screenshot_verified.png")

        await browser.close()
        print("✓ ALL TESTS PASSED SUCCESSFULLY with 0 errors!")

if __name__ == "__main__":
    asyncio.run(run_tests())
