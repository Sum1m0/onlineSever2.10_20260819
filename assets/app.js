(function () {
  "use strict";

  const recommendations = [
    { id: 1, scene: "流量争议", time: "14:33", confidence: "0.92", title: "确认异常流量范围", trigger: "客户提出本月流量消耗异常", content: "您好，我已经了解您反馈的流量消耗异常问题。为了进一步核实，请问您认为异常的是哪一天或哪个时间段？大约减少了多少流量？" },
    { id: 2, scene: "流量争议", time: "14:36", confidence: "0.96", title: "核对争议时段与使用记录", trigger: "客户补充昨晚一次性减少5GB", content: "了解到您反馈昨晚流量一次性减少约5GB。我先为您核对该时段的流量使用记录、套餐共享用量及达量状态。请问昨晚是否使用过热点共享、视频或系统后台更新？" }
  ];

  const paths = {
    "流量争议": [
      {
        message: "我没有开热点，也没看视频，手机当时基本没怎么用。",
        title: "继续核对后台用量与终端记录", trigger: "客户否认热点、视频等高流量行为", confidence: "0.97",
        content: "好的，已记录您未开启热点、未使用视频等高流量应用。我将继续核对争议时段的后台流量记录及终端统计差异。请您打开手机流量统计，确认昨晚该时段用量较高的应用名称。",
        summary: { known: "争议时段为昨晚，约减少5GB；客户确认未开启热点、未观看视频。", stage: "正在核对系统侧记录与终端流量统计。", pending: "确认争议时段用量较高的应用及后台更新情况。" }
      },
      {
        message: "手机统计里最高的应用也只用了几百兆，我想继续核查。",
        title: "说明差异并进入进一步核查", trigger: "终端记录与系统侧用量存在明显差异", confidence: "0.98",
        content: "从您提供的信息看，终端统计与系统侧流量记录存在较明显差异。我已记录争议时间和用量情况，建议继续核查该时段的计费明细及网络侧记录，并根据核查结果向您说明。",
        summary: { known: "争议时段为昨晚，约减少5GB；终端最高应用仅显示几百MB。", stage: "已发现终端记录与系统侧用量可能存在差异，进入进一步核查。", pending: "核查计费明细及网络侧记录，形成最终解释结论。" }
      }
    ],
    "费用争议": [
      {
        message: "主要是多了一笔50多元的费用，我没办过新业务。",
        title: "核对费用构成与订购记录", trigger: "客户指出多出50余元且否认办理新业务", confidence: "0.95",
        content: "了解到您对账单中新增的50余元费用存在疑问。我先为您核对本月账单构成、增值业务订购记录及生效渠道，请问您看到的具体收费项目名称是什么？",
        summary: { known: "客户反馈本月多出50余元，并确认未主动办理新业务。", stage: "正在确认具体争议费用项目及账单构成。", pending: "获取费用项目名称，核对订购时间、渠道和生效记录。" }
      },
      {
        message: "账单里写的是流量超套费，还有一个陌生的会员费。",
        title: "分别核验争议费用项目", trigger: "客户补充流量超套费及陌生会员费", confidence: "0.97",
        content: "好的，当前需要分别核验流量超套费和会员费：先确认超套流量、计费时间及单价，再核对会员业务的订购时间、订购渠道和生效记录。核验完成后我会逐项向您说明。",
        summary: { known: "争议费用包括流量超套费和一笔陌生会员费。", stage: "正在分别核验两项费用的计费及订购记录。", pending: "确认超套计费明细、会员业务订购渠道及生效时间。" }
      }
    ]
  };

  let scene = "流量争议";
  let selectedId = 2;
  let thinking = false;
  let ended = false;
  let currentFlowStep = 3;
  let maxReachedFlowStep = 3;
  const pathIndex = { "流量争议": 0, "费用争议": 0 };
  const qualityIssues = [{ type: "业务口径风险", description: "存在未经核实的绝对化表述", evidence: "系统记录肯定不会出错，应该就是您手机产生的流量。", time: "14:37" }];
  const $ = (id) => document.getElementById(id);
  const now = () => new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  const latest = () => recommendations[recommendations.length - 1];
  const selected = () => recommendations.find((item) => item.id === selectedId) || latest();

  function toast(text) {
    $("toast").textContent = "✓ " + text;
    $("toast").classList.remove("hidden");
    window.setTimeout(() => $("toast").classList.add("hidden"), 1800);
  }

  function showServiceWorkspace() {
    $("serviceWorkspace").classList.remove("hidden");
    $("businessWorkspace").classList.add("hidden");
    $("serviceTab").classList.add("active");
    $("businessTab").classList.remove("active");
  }

  function showBusinessWorkspace() {
    $("businessTab").classList.remove("hidden");
    $("serviceWorkspace").classList.add("hidden");
    $("businessWorkspace").classList.remove("hidden");
    $("serviceTab").classList.remove("active");
    $("businessTab").classList.add("active");
  }

  function syncBusinessScene(targetScene, item) {
    const businessScene = targetScene || scene;
    $("businessPageTitle").textContent = businessScene + "核查与处理";
    $("businessFormTitle").textContent = businessScene + "复核受理";
    $("businessType").value = businessScene === "费用争议" ? "费用争议复核" : "流量争议复核";
  }

  function showRecommendation(item, scrollMode) {
    selectedId = item.id;
    renderRecommendations(scrollMode || "selected");
  }

  function renderRecommendations(scrollMode) {
    const list = $("recommendationList");
    list.innerHTML = "";
    recommendations.forEach((item) => {
      const isSelected = selectedId === item.id;
      const isLatest = item.id === latest().id;
      const card = document.createElement("article");
      card.className = "timeline-recommend-card" + (isSelected ? " selected" : "");
      card.dataset.id = String(item.id);
      card.innerHTML =
        (!isLatest ? '<div class="history-review-banner"><b>正在回看：</b>' + item.time + ' 的历史推荐记录' + (isSelected ? '，话术与办理入口已同步切换' : '，点击可重新选用') + '</div>' : '') +
        '<div class="timeline-card-state"><span>' + item.time + ' 生成</span><span class="' + (isLatest ? 'current-record' : '') + '">' + (isLatest ? '当前推荐' : '历史推荐') + '</span></div>' +
        '<div class="scene-row"><div><span class="scene-badge">场景：' + item.scene + '</span><span class="confidence">' + (item.confidence === '人工选择' ? '人工选择' : '匹配度 ' + item.confidence) + '</span></div></div>' +
        '<div class="recommend-content"><div class="recommend-title">' + item.title + '</div><p>' + item.content + '</p></div>' +
        '<div class="trigger-line">识别依据：' + item.trigger + '</div>' +
        '<div class="recommend-actions"><span class="ai-note">内容由AI生成，仅供坐席参考</span><button class="copy-rec">复制</button><button class="primary-small fill-rec">填入输入框</button></div>' +
        '<div class="business-entry"><div class="business-entry-head"><span>业</span><div><strong>' + item.scene + '处理</strong><small>与' + item.time + '推荐绑定的办理入口</small></div></div><button class="open-business">进入办理 <b>↗</b></button></div>';
      list.appendChild(card);
    });
    window.requestAnimationFrame(() => {
      const timeline = $("recommendationTimeline");
      if (scrollMode === "bottom") timeline.scrollTop = timeline.scrollHeight;
      else {
        const target = list.querySelector('.timeline-recommend-card[data-id="' + selectedId + '"]');
        if (target) target.scrollIntoView({ block: "nearest" });
      }
    });
  }

  function setThinking(value) {
    thinking = value;
    $("thinkingBox").classList.toggle("hidden", !value);
    $("recommendationList").classList.toggle("hidden", value);
    $("listeningHint").classList.toggle("hidden", !value);
    $("sendReply").disabled = value || ended;
  }

  function addMessage(role, text) {
    const row = document.createElement("div");
    row.className = "message-line " + role;
    const meta = role === "customer" ? "张女士　" + now() : "坐席 · 陈静　" + now();
    if (role === "customer") row.innerHTML = '<div class="mini-avatar">张</div><div class="message-wrap"><div class="message-meta">' + meta + '</div><div class="message-bubble"></div></div>';
    else row.innerHTML = '<div class="message-wrap"><div class="message-meta">' + meta + '</div><div class="message-bubble"></div></div><div class="mini-avatar agent-avatar">静</div>';
    row.querySelector(".message-bubble").textContent = text;
    $("messageList").insertBefore(row, $("listeningHint"));
    $("messageList").scrollTop = $("messageList").scrollHeight;
    return row;
  }

  function inspectAgentText(text, row) {
    const hits = [];
    if (/不归我管|爱咋|随便|自己看|别问我|不知道/.test(text)) hits.push({ type: "服务禁语", description: "存在推诿或不当服务表达" });
    if (/百分之百|绝对|肯定能|一定会|保证处理|保证解决/.test(text)) hits.push({ type: "业务口径风险", description: "存在未经核实的绝对化承诺" });
    if (/投诉就投诉|找领导|转领导|转接领导/.test(text)) hits.push({ type: "升级诉求处置不当", description: "对投诉或升级诉求的回应不符合服务规范" });
    hits.forEach((hit) => qualityIssues.push({ ...hit, evidence: text, time: now() }));
    if (hits.length) {
      const warning = document.createElement("div");
      warning.className = "qc-warning";
      warning.innerHTML = '<strong>⚠ 质检提醒 · ' + hits.map((hit) => hit.type).join("、") + '：</strong>' + hits.map((hit) => hit.description).join("；") + '，建议修改后再继续服务。';
      row.querySelector(".message-wrap").appendChild(warning);
    }
  }

  function updateSummary(data) {
    $("summaryStatus").textContent = "更新中";
    $("summaryStatus").classList.add("updating");
    window.setTimeout(() => {
      $("summaryProblem").textContent = scene === "流量争议" ? "客户反馈昨晚流量一次性减少约5GB，与实际使用情况不符。" : "客户对本月新增费用存在异议，要求核对具体收费项目。";
      $("summaryKnown").textContent = data.known;
      $("summaryStage").textContent = data.stage;
      $("summaryPending").textContent = data.pending;
      $("summaryStatus").textContent = "已实时更新";
      $("summaryStatus").classList.remove("updating");
    }, 450);
  }

  function receiveCustomerReply() {
    const path = paths[scene];
    const data = path[pathIndex[scene] % path.length];
    pathIndex[scene] += 1;
    addMessage("customer", data.message);
    updateSummary(data.summary);
    setThinking(true);
    window.setTimeout(() => {
      const item = { id: Date.now(), scene, time: now(), confidence: data.confidence, title: data.title, trigger: data.trigger, content: data.content };
      recommendations.push(item);
      setThinking(false);
      showRecommendation(item, "bottom");
    }, 1500);
  }

  function sendReply() {
    if (thinking || ended) return;
    const text = $("replyInput").value.trim();
    if (!text) { toast("请先填写坐席回复"); return; }
    const row = addMessage("agent", text);
    inspectAgentText(text, row);
    $("replyInput").value = "";
    $("sendReply").disabled = true;
    window.setTimeout(receiveCustomerReply, 700);
  }

  function endSession() {
    if (ended) return;
    ended = true;
    const agentRows = Array.from(document.querySelectorAll(".message-line.agent .message-bubble"));
    const lastText = agentRows.length ? agentRows[agentRows.length - 1].childNodes[0].textContent.trim() : "";
    if (!/感谢|祝您|再见|还有其他|请问还有/.test(lastText)) qualityIssues.push({ type: "未说结束语", description: "会话结束前未使用规范结束语", evidence: lastText || "无结束回复", time: now() });

    const counts = {};
    qualityIssues.forEach((item) => { counts[item.type] = (counts[item.type] || 0) + 1; });
    const tag = $("qualityTag");
    const summary = $("qualitySummary");
    if (qualityIssues.length) {
      tag.textContent = "违规";
      tag.classList.add("violation");
      summary.classList.remove("hidden", "pass");
      summary.innerHTML = Object.keys(counts).map((type) => type + "（" + counts[type] + "次）").join("、") + "。";
    } else {
      tag.textContent = "合格";
      tag.classList.add("pass");
      summary.classList.remove("hidden");
      summary.classList.add("pass");
      summary.textContent = "本次会话未发现服务规范、业务口径或不当表达问题。";
    }
    $("summaryStatus").textContent = "会话已结束";
    $("summaryPending").textContent = "无；本次服务小结及质检结果已形成。";
    $("endSession").textContent = "会话已结束";
    $("endSession").classList.add("ended");
    document.querySelector(".composer").classList.add("ended");
    $("messageList").scrollTop = 0;
    toast("已生成本次会话质检总结果");
  }

  const flowDetails = {
    1: "识别争议场景，结合客户与坐席的多轮对话判断当前诉求。",
    2: "确认争议范围，明确业务对象、异常时间、用量或费用项目。",
    3: "调用诊断能力，核对套餐、共享用量、达量状态及相关记录。",
    4: "形成问题结论，匹配客户描述与诊断结果并定位主要原因。",
    5: "推荐解释与处理，生成解释口径、处理建议及对应办理入口。"
  };

  function renderFlowStep() {
    document.querySelectorAll(".flow-step").forEach((button) => {
      const step = Number(button.dataset.step);
      button.classList.toggle("current", step === currentFlowStep);
      button.classList.toggle("done", step !== currentFlowStep && step <= maxReachedFlowStep);
      button.disabled = step > maxReachedFlowStep;
    });
    $("flowNote").innerHTML = "<b>当前第" + currentFlowStep + "步：</b>" + flowDetails[currentFlowStep] + (maxReachedFlowStep > 1 ? "<span>可点击已处理步骤回退或返回</span>" : "");
  }

  $("recommendationList").addEventListener("click", (event) => {
    const card = event.target.closest(".timeline-recommend-card");
    if (!card) return;
    const item = recommendations.find((record) => String(record.id) === card.dataset.id);
    if (!item) return;
    if (event.target.closest(".fill-rec")) {
      selectedId = item.id;
      $("replyInput").value = item.content;
      $("replyInput").focus();
      renderRecommendations("selected");
      toast("已填入左侧回复输入框");
      return;
    }
    if (event.target.closest(".copy-rec")) {
      selectedId = item.id;
      renderRecommendations("selected");
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(item.content).then(() => toast("话术已复制")).catch(() => toast("请选中文本后复制"));
      else toast("请选中文本后复制");
      return;
    }
    if (event.target.closest(".open-business")) {
      selectedId = item.id;
      syncBusinessScene(item.scene, item);
      renderRecommendations("selected");
      showBusinessWorkspace();
      return;
    }
    if (selectedId !== item.id) showRecommendation(item, "selected");
  });
  $("sendReply").addEventListener("click", sendReply);
  $("replyInput").addEventListener("keydown", (event) => { if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) sendReply(); });
  $("endSession").addEventListener("click", endSession);
  $("serviceTab").addEventListener("click", showServiceWorkspace);
  $("businessTab").addEventListener("click", showBusinessWorkspace);
  $("closeBusiness").addEventListener("click", (event) => { event.stopPropagation(); $("businessTab").classList.add("hidden"); showServiceWorkspace(); });
  $("returnService").addEventListener("click", showServiceWorkspace);
  $("submitBusiness").addEventListener("click", () => {
    $("businessSubmitResult").classList.remove("hidden");
    $("submitBusiness").textContent = "已提交";
    $("submitBusiness").disabled = true;
    toast("业务受理已提交");
  });
  document.querySelectorAll(".flow-step").forEach((button) => button.addEventListener("click", () => {
    const step = Number(button.dataset.step);
    if (step > maxReachedFlowStep || step === currentFlowStep) return;
    currentFlowStep = step;
    renderFlowStep();
    toast("已切换至流程第" + step + "步");
  }));
  $("openScene").addEventListener("click", () => $("sceneModal").classList.remove("hidden"));
  $("closeScene").addEventListener("click", () => $("sceneModal").classList.add("hidden"));
  $("sceneModal").addEventListener("click", (event) => { if (event.target === $("sceneModal")) $("sceneModal").classList.add("hidden"); });
  document.querySelectorAll(".scene-option").forEach((button) => button.addEventListener("click", () => {
    const nextScene = button.dataset.scene;
    if (nextScene === scene) { $("sceneModal").classList.add("hidden"); toast("当前已是该场景，推荐内容保持不变"); return; }
    scene = nextScene;
    document.querySelectorAll(".scene-option").forEach((item) => { const current = item.dataset.scene === scene; item.classList.toggle("selected", current); item.querySelector("i").textContent = current ? "当前" : "选择"; });
    $("sceneModal").classList.add("hidden");
    $("flowTitle").textContent = scene + "处理流程";
    syncBusinessScene(scene);
    currentFlowStep = 1;
    maxReachedFlowStep = 1;
    renderFlowStep();
    updateSummary(scene === "费用争议" ? { known: "坐席已切换至费用争议场景。", stage: "正在根据完整会话重新理解费用诉求。", pending: "确认争议费用名称及账单构成。" } : { known: "坐席已切换至流量争议场景。", stage: "正在根据完整会话重新理解流量诉求。", pending: "确认异常时段及流量变化。" });
    setThinking(true);
    window.setTimeout(() => {
      const item = scene === "费用争议"
        ? { id: Date.now(), scene, time: now(), confidence: "人工选择", title: "确认争议费用项目", trigger: "坐席手动切换场景，保留完整会话重新分析", content: "结合当前完整对话，客户的核心疑问可能涉及费用项目。建议先确认本月账单总额、争议费用名称及是否办理过相关业务，再逐项核对计费和订购记录。" }
        : { id: Date.now(), scene, time: now(), confidence: "人工选择", title: "确认异常流量范围", trigger: "坐席手动切换场景，保留完整会话重新分析", content: "结合当前完整对话，客户反馈的问题更符合流量争议。建议确认异常时间段和流量变化，并核对套餐、共享用量、达量状态及终端记录。" };
      recommendations.push(item); setThinking(false); showRecommendation(item, "bottom");
    }, 1300);
  }));

  renderRecommendations("bottom");
  renderFlowStep();
})();
