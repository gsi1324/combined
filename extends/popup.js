// DOMContentLoaded 이벤트 리스너
document.addEventListener("DOMContentLoaded", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = tabs[0].url;

    // 현재 탭의 URL을 확인하여 BBC, CNN 사이트 종류 판별
    let detectedSite = "";
    if (url.includes("bbc.com")) {
      detectedSite = "bbc";
    } else if (url.includes("cnn.com")) {
      detectedSite = "cnn";
    } else {
      detectedSite = "other";
    }

    // 판별된 사이트 값을 드롭다운에 설정
    const newsSiteDropdown = document.getElementById("news-site");
    newsSiteDropdown.value = detectedSite;
  });
});

// '크롤링' 버튼 클릭 이벤트 리스너
document.getElementById("crawl-content").addEventListener("click", () => {
  const selectedSite = document.getElementById("news-site").value;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript(
      {
        target: { tabId: tabs[0].id },
        function: getFilteredMainContent, //사이트 별로 크롤링
        args: [selectedSite],
      },
      (results) => {
        // 전체 크롤링된 콘텐츠를 텍스트 박스에 표시
        const mainContent = results[0].result || "내용이 없습니다.";
        document.getElementById("content-display").value = mainContent;
      }
    );
  });
});
// 닫기 버튼 요소 가져오기
const closeButton = document.querySelector(".close-btn");

// 닫기 버튼 클릭 이벤트 리스너 추가
if (closeButton) {
  closeButton.addEventListener("click", () => {
    window.close(); // 팝업 창 닫기
  });
}

// '요약 및 번역' 버튼 클릭 이벤트 리스너
document.getElementById("summarize-content").addEventListener("click", () => {
  let content = document.getElementById("content-display").value;
  if (!content) {
    alert("먼저 콘텐츠를 크롤링하세요.");
    return;
  }
  //=====================================================================================
  // 2000자를 초과하는 경우 문장 단위로 자르기
  if (content.length > 2000) {
    let truncatedContent = content.slice(0, 2000); // 우선 2000자까지 자름
    const lastSentenceEnd = Math.max(
      truncatedContent.lastIndexOf("."),
      truncatedContent.lastIndexOf("!"),
      truncatedContent.lastIndexOf("?")
    );

    // 마지막 문장의 종료 지점을 기준으로 자름
    if (lastSentenceEnd !== -1) {
      content = truncatedContent.slice(0, lastSentenceEnd + 1);
    } else {
      // 문장 종료 기호가 없는 경우 기본적으로 2000자로 자름
      content = truncatedContent;
    }

    //alert("텍스트가 2000자 이하로 잘렸습니다.");
  }
  //======================================================================================
  // 최종적으로 전달할 텍스트 로그 출력
  console.log("최종적으로 서버에 전달되는 텍스트:", content);

  const summaryDisplay = document.getElementById("summary-display");
  summaryDisplay.value = ""; // 결과 초기화

  // 로딩 스피너 요소 가져오기
  const loadingSpinner = document.getElementById("loading-spinner");
  // 로딩 스피너 표시
  loadingSpinner.style.display = "block";

  async function processContent() {
    const requestData = JSON.stringify({ text: content });

    //서버 통신
    try {
      const response = await fetch("http://34.64.81.1:8080/process_text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: requestData,
      });

      if (!response.ok) {
        console.error("API 호출 실패:", response.status, response.statusText);
        summaryDisplay.value = "\n[요약 실패]";
        return;
      }

      const data = await response.json();
      if (data && data.summary_translation) {
        summaryDisplay.value = data.summary_translation;
      } else {
        summaryDisplay.value = "\n[요약 생성 실패]";
      }
    } catch (error) {
      console.error("요약 오류:", error);
      summaryDisplay.value = "\n[요약에 실패했습니다.]";
    } finally {
      loadingSpinner.style.display = "none";
    }
  }

  processContent();
});

// 사이트별로 HTML 콘텐츠를 추출하는 함수
function getFilteredMainContent(selectedSite) {
  let content = "";

  if (selectedSite === "bbc") {
    const textBlocks = document.querySelectorAll(
      'div[data-component="text-block"]'
    );
    console.log("BBC : ", textBlocks.length); // 디버깅용 로그
    textBlocks.forEach((block) => {
      content += block.textContent.trim() + "\n\n";
    });
  } else if (selectedSite === "cnn") {
    const paragraphs = document.querySelectorAll(
      "p.paragraph.inline-placeholder.vossi-paragraph"
    );
    console.log("CNN : ", paragraphs.length); // 디버깅용 로그
    paragraphs.forEach((paragraph) => {
      content += paragraph.textContent.trim() + "\n\n";
    });
  } else if (selectedSite === "other") {
    alert("지원히지 않는 사이트입니다. BBC나 CNN 페이지에서 실행하세요.");
    return;
  }

  console.log("전달된 기사 본문 :", content); // 추출된 콘텐츠 확인용 로그
  content = content
    .replace(/\s\s+/g, " ")
    .replace(/(\.\s)/g, ".\n\n")
    .trim();
  return content || "텍스트 블록에 내용이 없습니다.";
}
