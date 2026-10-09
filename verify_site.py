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

        # Quality Gate: SVG Text Clipping & DOM Overflow Check
        print("Running Quality Gate: SVG Text Clipping & DOM Overflow Check...")
        clipped_svg = await page.evaluate('''() => {
            const issues = [];
            document.querySelectorAll('svg').forEach(svg => {
                const vb = svg.viewBox.baseVal;
                if (!vb || vb.width === 0) return;
                svg.querySelectorAll('text, tspan').forEach(t => {
                    const text = t.textContent.trim();
                    if (!text) return;
                    try {
                        const bbox = t.getBBox();
                        if (bbox.x < vb.x - 2 || (bbox.x + bbox.width) > (vb.x + vb.width + 2)) {
                            issues.push({ text: text, x: bbox.x, width: bbox.width, vb_x: vb.x, vb_w: vb.width });
                        }
                    } catch (e) {}
                });
            });
            return issues;
        }''')
        print(f"SVG Text clipping issues found: {len(clipped_svg)}")
        assert len(clipped_svg) == 0, f"Found clipped SVG text elements: {clipped_svg}"

        # Multi-viewport responsive tests
        viewports = [
            ("Desktop 1440px", {"width": 1440, "height": 900}),
            ("Tablet 768px", {"width": 768, "height": 1024}),
            ("Mobile 375px", {"width": 375, "height": 812})
        ]
        for name, vp in viewports:
            await page.set_viewport_size(vp)
            await page.wait_for_timeout(300)
            has_h_scroll = await page.evaluate('''() => {
                return document.documentElement.scrollWidth > window.innerWidth + 2;
            }''')
            print(f"Viewport {name} -> Horizontal scroll detected: {has_h_scroll}")
            assert not has_h_scroll, f"Horizontal scroll detected on {name}!"

        # Reset viewport to 1440px and capture verified screenshot
        await page.set_viewport_size({"width": 1440, "height": 900})
        await page.screenshot(path="screenshot_verified.png", full_page=True)
        print("Screenshot saved to screenshot_verified.png")

        await browser.close()
        print("✓ ALL TESTS PASSED SUCCESSFULLY with 0 errors!")

if __name__ == "__main__":
    asyncio.run(run_tests())
