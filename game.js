class DemocracyMatch {
  constructor() {
    this.canvas = document.getElementById("puzzleCanvas");
    this.ctx = this.canvas.getContext("2d");

    this.state = {
      board: [],
      remainingTurns: CONFIG.MAX_TURNS,
      score: 0,
      oppressionHp: CONFIG.MAX_OPPRESSION,
      playerHp: CONFIG.MAX_PLAYER_HP,
      baseDecayRate: 4,
      currentEnemyIdx: 0,
      enemyCd: 0,
      elapsedTurns: 0,
      cabinetDecisionTurns: 0,
      party: [],
      partyIconIndices: [],
      bribedMembers: Array(5).fill(false),
      selectedSlot: 0,
      popups: [],
      dragState: {
        isDragging: false,
        startTile: { r: 0, c: 0 },
        targetTile: { r: 0, c: 0 },
        dragPos: { x: 0, y: 0 }
      },
      animating: false,
      lastResult: { isWin: false, score: 0, remTurns: 0 }
    };

    this.enemies = this.initEnemies();
    this.bindEvents();
    this.randomizeParty();
    this.resetGame();
  }

  initEnemies() {
    return [
      { 
        name: "スマホ農場", skillName: "虚偽拡散", cdMax: 3,
        desc: "25ダメージ＋すべての「疑問💬」を「虚偽」に変更", 
        action: () => { 
          this.damagePlayer(25); 
          return this.convertQuestionToFake() > 0;
        } 
      },
      { 
        name: "捏造報道局", skillName: "スピン報道", cdMax: 3,
        desc: "25ダメージ＋「報道」を「虚偽」と「非開示」に変化してシャッフル", 
        action: () => { 
          this.damagePlayer(25); 
          this.convertReportToFakeAndBlackout();
          this.shuffleBoard(); 
          return true;
        } 
      },
      { 
        name: "隠蔽議員", skillName: "答弁は差し控えさせていただきます", cdMax: 3,
        desc: "25ダメージ＋4マスを非開示化", 
        action: () => { 
          this.damagePlayer(25); 
          return this.applyBlackout(4) > 0;
        } 
      },
      { 
        name: "懐柔工作財団", skillName: "買収", cdMax: 3,
        desc: "25ダメージ＋パーティ2名を買収(無効化)", 
        action: () => { 
          this.damagePlayer(25); 
          const b1 = this.bribeMember(); 
          const b2 = this.bribeMember(); 
          return b1 || b2;
        } 
      },
      {
        name: "世論誘導広報室", skillName: "プロパガンダ", cdMax: 3,
        desc: "25ダメージ＋3×3の虚偽マスを発生（2ターンで回復）",
        action: () => {
          this.damagePlayer(25);
          return this.applyPropaganda() > 0;
        }
      },
      {
        name: "独断内閣", skillName: "閣議決定", cdMax: 3, minTurnReq: 6,
        desc: "25ダメージ＋「調査」「検証」の無効化（2ターン継続）",
        action: () => {
          this.damagePlayer(25);
          this.state.cabinetDecisionTurns = 2;
          return true;
        }
      }
    ];
  }

  bindEvents() {
    const getPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const handleStart = (pos) => {
      if (this.state.animating) return;
      const c = Math.floor(pos.x / CONFIG.TILE_SIZE);
      const r = Math.floor(pos.y / CONFIG.TILE_SIZE);
      if (r >= 0 && r < CONFIG.ROWS && c >= 0 && c < CONFIG.COLS) {
        this.state.dragState = {
          isDragging: true,
          startTile: { r, c },
          targetTile: { r, c },
          dragPos: pos
        };
        this.render();
      }
    };

    const handleMove = (pos) => {
      if (!this.state.dragState.isDragging || this.state.animating) return;
      this.state.dragState.dragPos = pos;
      const c = Math.floor(pos.x / CONFIG.TILE_SIZE);
      const r = Math.floor(pos.y / CONFIG.TILE_SIZE);
      const start = this.state.dragState.startTile;

      if (r >= 0 && r < CONFIG.ROWS && c >= 0 && c < CONFIG.COLS) {
        const rowDiff = Math.abs(r - start.r);
        const colDiff = Math.abs(c - start.c);
        if ((rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1)) {
          this.state.dragState.targetTile = { r, c };
          handleEnd();
          return;
        }
      }
      this.render();
    };

    const handleEnd = () => {
      if (!this.state.dragState.isDragging) return;
      this.state.dragState.isDragging = false;
      const { startTile: start, targetTile: target } = this.state.dragState;

      if (start.r === target.r && start.c === target.c) {
        this.render();
        return;
      }

      const temp = this.state.board[start.r][start.c];
      this.state.board[start.r][start.c] = this.state.board[target.r][target.c];
      this.state.board[target.r][target.c] = temp;

      if (this.findMatches().length > 0) {
        this.processMatches();
      } else {
        this.render();
      }
    };

    this.canvas.addEventListener("mousedown", (e) => handleStart(getPos(e)));
    this.canvas.addEventListener("mousemove", (e) => handleMove(getPos(e)));
    this.canvas.addEventListener("mouseup", handleEnd);

    this.canvas.addEventListener("touchstart", (e) => handleStart(getPos(e.touches[0])), { passive: true });
    this.canvas.addEventListener("touchmove", (e) => handleMove(getPos(e.touches[0])), { passive: true });
    this.canvas.addEventListener("touchend", handleEnd);

    document.getElementById("btn-party-open").onclick = () => this.openPartyModal();
    document.getElementById("btn-party-close").onclick = () => this.closePartyModal();
    document.getElementById("btn-party-random").onclick = () => {
      this.randomizeParty();
      this.renderPartyModalSlots();
    };
    document.getElementById("btn-reset").onclick = () => this.resetGame();
    document.getElementById("btn-result-restart").onclick = () => this.resetGame();
    document.getElementById("btn-share-x").onclick = () => this.shareToX();
    document.getElementById("btn-share-other").onclick = () => this.shareOther();
  }

  getRandomDropType() {
    const weights = { QUESTION: 10, REPORT: 10, VERIFY: 10, SIGN: 10, DEMO: 10, DIALOGUE: 10 };

    this.state.party.forEach((id, idx) => {
      if (!this.state.bribedMembers[idx] && id === "reporter") {
        weights.REPORT += 15;
      }
    });

    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    let rand = Math.random() * totalWeight;
    for (const key in weights) {
      if (rand <= weights[key]) return key;
      rand -= weights[key];
    }
    return "QUESTION";
  }

  randomizeParty() {
    this.state.party = [];
    this.state.partyIconIndices = [];
    for (let i = 0; i < 5; i++) {
      const randJob = JOBS[Math.floor(Math.random() * JOBS.length)];
      this.state.party.push(randJob.id);
      this.state.partyIconIndices.push(Math.floor(Math.random() * randJob.icons.length));
    }
  }

  resetGame() {
    document.getElementById("result-modal").style.display = "none";
    Object.assign(this.state, {
      remainingTurns: CONFIG.MAX_TURNS,
      score: 0,
      oppressionHp: CONFIG.MAX_OPPRESSION,
      playerHp: CONFIG.MAX_PLAYER_HP,
      baseDecayRate: 4,
      elapsedTurns: 0,
      cabinetDecisionTurns: 0,
      bribedMembers: Array(5).fill(false),
      popups: []
    });

    this.setupEnemy(-1);
    this.createBoard();
    this.updateUI();
    this.render();
  }

  setupEnemy(prevIdx) {
    const available = this.enemies.filter(e => e.minTurnReq === undefined || this.state.remainingTurns <= e.minTurnReq);
    let nextIdx;
    do {
      const candidate = available[Math.floor(Math.random() * available.length)];
      nextIdx = this.enemies.indexOf(candidate);
    } while (available.length > 1 && nextIdx === prevIdx);

    this.state.currentEnemyIdx = nextIdx;
    
    const cdLimit = (this.state.remainingTurns <= 10 || this.state.oppressionHp < CONFIG.MAX_OPPRESSION * 0.2) ? 2 : 3;
    this.state.enemyCd = cdLimit;
  }

  calculateBuffs() {
    const buffs = { 
      verifyMult: 1.0, 
      reporterCount: 0, 
      bribedReporterCount: 0,
      comboBonus: 0.0, 
      healMult: 1.0, 
      lawyerCount: 0, 
      citizenCount: 0,
      professionTypeCount: 0,
      expertCount: 0,
      signDemoPower: 0
    };

    const activeProfessions = new Set();
    let activeCitizenCount = 0;

    this.state.party.forEach((id, idx) => {
      const isBribed = this.state.bribedMembers[idx];
      if (!isBribed) {
        if (id === "citizen") activeCitizenCount++;
        else activeProfessions.add(id);

        if (id === "lawyer") buffs.lawyerCount++;
        if (id === "reporter") buffs.reporterCount++;
        if (id === "politician") buffs.healMult += 0.40;
        if (id === "expert") {
          buffs.expertCount++;
          buffs.verifyMult += 0.40;
          buffs.comboBonus += 0.15;
        }
      } else {
        if (id === "politician") buffs.healMult -= 0.30;
        if (id === "reporter") buffs.bribedReporterCount++;
      }
    });

    buffs.citizenCount = activeCitizenCount;
    buffs.professionTypeCount = activeProfessions.size;
    buffs.signDemoPower = buffs.professionTypeCount * buffs.citizenCount * 10;
    if (buffs.healMult < 0.2) buffs.healMult = 0.2;

    return buffs;
  }

  createBoard() {
    let isValid = false;
    while (!isValid) {
      this.state.board = [];
      for (let r = 0; r < CONFIG.ROWS; r++) {
        this.state.board[r] = [];
        for (let c = 0; c < CONFIG.COLS; c++) {
          this.state.board[r][c] = {
            type: this.getRandomDropType(),
            blackout: false,
            yOffset: 0,
            scale: 1,
            propagandaTimer: 0
          };
        }
      }
      if (this.findMatches().length === 0) isValid = true;
    }
  }

  async processMatches() {
    this.state.animating = true;
    let comboCount = 0;
    const buffs = this.calculateBuffs();
    let turnDamage = 0;
    let dialogueSkillTriggered = false;
    let verifySkillTriggered = false;
    let verifyInvalidatedBannerShown = false;

    while (true) {
      const matchGroups = this.findMatchGroups();
      if (matchGroups.length === 0) break;

      comboCount++;
      const allMatchedTiles = [];
      let hasReportMatchFourOrMore = false;

      matchGroups.forEach(group => {
        if (group.type === "REPORT" && group.tiles.length >= 4) {
          hasReportMatchFourOrMore = true;
        }
        allMatchedTiles.push(...group.tiles);
      });

      if (buffs.reporterCount > 0 && hasReportMatchFourOrMore) {
        if (this.convertAllQuestionsToAction() > 0) {
          this.showSkillBanner("報道の自由", "すべての「疑問💬」を「署名📜」「デモ🪧」へ一括変換");
        }
      }

      const uniqueMatches = allMatchedTiles.filter((v, i, a) => a.findIndex(t => t.r === v.r && t.c === v.c) === i);
      const avgX = uniqueMatches.reduce((sum, m) => sum + m.c, 0) / uniqueMatches.length * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
      const avgY = uniqueMatches.reduce((sum, m) => sum + m.r, 0) / uniqueMatches.length * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
      const firstType = this.state.board[uniqueMatches[0].r][uniqueMatches[0].c].type;
      const lastName = DROPS[firstType] ? DROPS[firstType].name : "消去";

      this.state.popups = [{
        x: avgX, y: avgY - 10,
        text1: lastName,
        text2: `${comboCount} combo`,
        timer: 12
      }];

      matchGroups.forEach(group => {
        const count = group.tiles.length;
        const matchCountMult = count === 4 ? 1.5 : (count >= 5 ? 2.0 : 1.0);

        group.tiles.forEach(m => {
          const t = this.state.board[m.r][m.c];
          if (!t) return;

          if (t.type === "DIALOGUE") {
            const prevHp = this.state.playerHp;
            const healVal = Math.floor(DROPS.DIALOGUE.heal * buffs.healMult * matchCountMult);
            this.state.playerHp = Math.min(CONFIG.MAX_PLAYER_HP, this.state.playerHp + healVal);
            
            const hpRestored = this.state.playerHp > prevHp;
            const cleansedFake = this.cleanseFakeTiles(2);
            const restoredBribed = this.restoreBribedMember();

            if ((hpRestored || cleansedFake > 0 || restoredBribed) && !dialogueSkillTriggered) {
              this.showSkillBanner("公共の福祉", "気力回復 / 買収奪還 / 虚偽訂正");
              dialogueSkillTriggered = true;
            }
          } else if (t.type === "FAKE") {
            this.damagePlayer(DROPS.FAKE.penaltyDamage);
          } else if (t.type === "VERIFY") {
            if (this.state.cabinetDecisionTurns > 0) {
              if (!verifyInvalidatedBannerShown) {
                this.showSkillBanner("閣議決定", "「検証」の効果は無効化された！");
                verifyInvalidatedBannerShown = true;
              }
            } else {
              const finalPower = Math.floor(DROPS.VERIFY.power * buffs.verifyMult * (1 + (comboCount - 1) * (0.15 + buffs.comboBonus)) * matchCountMult);
              turnDamage += finalPower;
              this.state.score += finalPower;

              const revCount = this.revealBlackout();
              const clnCount = this.cleanseFakeTiles(1);
              if ((revCount > 0 || clnCount > 0) && !verifySkillTriggered) {
                this.showSkillBanner("客観性の担保", "非開示解除 / 虚偽訂正");
                verifySkillTriggered = true;
              }
            }
          } else if (t.type === "SIGN" || t.type === "DEMO") {
            const finalPower = Math.floor(buffs.signDemoPower * (1 + (comboCount - 1) * (0.15 + buffs.comboBonus)) * matchCountMult);
            turnDamage += finalPower;
            this.state.score += finalPower;
          } else if (DROPS[t.type]) {
            const finalPower = Math.floor(DROPS[t.type].power * (1 + (comboCount - 1) * (0.15 + buffs.comboBonus)) * matchCountMult);
            turnDamage += finalPower;
            this.state.score += finalPower;
          }
        });
      });

      this.state.oppressionHp = Math.max(0, this.state.oppressionHp - turnDamage);
      this.updateUI();

      for (let i = 0; i < 4; i++) {
        this.render();
        await this.sleep(25);
      }

      this.applyGravity(uniqueMatches);
      await this.animateDrop();
    }

    this.state.animating = false;
    this.endTurn();
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  findMatches() {
    const groups = this.findMatchGroups();
    const matched = [];
    groups.forEach(g => matched.push(...g.tiles));
    return matched.filter((v, i, a) => a.findIndex(t => t.r === v.r && t.c === v.c) === i);
  }

  findMatchGroups() {
    const groups = [];

    for (let r = 0; r < CONFIG.ROWS; r++) {
      let c = 0;
      while (c < CONFIG.COLS) {
        let matchLen = 1;
        const t1 = this.state.board[r][c];
        if (t1 && !t1.blackout) {
          while (c + matchLen < CONFIG.COLS) {
            const t2 = this.state.board[r][c + matchLen];
            if (t2 && !t2.blackout && t1.type === t2.type) matchLen++;
            else break;
          }
        }
        if (matchLen >= 3) {
          const tiles = [];
          for (let i = 0; i < matchLen; i++) tiles.push({ r, c: c + i });
          groups.push({ type: t1.type, tiles });
        }
        c += Math.max(1, matchLen);
      }
    }

    for (let c = 0; c < CONFIG.COLS; c++) {
      let r = 0;
      while (r < CONFIG.ROWS) {
        let matchLen = 1;
        const t1 = this.state.board[r][c];
        if (t1 && !t1.blackout) {
          while (r + matchLen < CONFIG.ROWS) {
            const t2 = this.state.board[r + matchLen][c];
            if (t2 && !t2.blackout && t1.type === t2.type) matchLen++;
            else break;
          }
        }
        if (matchLen >= 3) {
          const tiles = [];
          for (let i = 0; i < matchLen; i++) tiles.push({ r: r + i, c });
          groups.push({ type: t1.type, tiles });
        }
        r += Math.max(1, matchLen);
      }
    }
    return groups;
  }

  applyGravity(matches) {
    matches.forEach(m => this.state.board[m.r][m.c] = null);

    for (let c = 0; c < CONFIG.COLS; c++) {
      let emptySlots = 0;
      for (let r = CONFIG.ROWS - 1; r >= 0; r--) {
        if (this.state.board[r][c] === null) {
          emptySlots++;
        } else if (emptySlots > 0) {
          this.state.board[r + emptySlots][c] = this.state.board[r][c];
          this.state.board[r + emptySlots][c].yOffset = -emptySlots * CONFIG.TILE_SIZE;
          this.state.board[r][c] = null;
        }
      }
      for (let i = 0; i < emptySlots; i++) {
        this.state.board[i][c] = {
          type: this.getRandomDropType(),
          blackout: false,
          yOffset: -emptySlots * CONFIG.TILE_SIZE,
          scale: 1,
          propagandaTimer: 0
        };
      }
    }
  }

  animateDrop() {
    return new Promise(resolve => {
      let step = 0;
      const totalSteps = 4;
      const interval = setInterval(() => {
        step++;
        let hasOffset = false;
        for (let r = 0; r < CONFIG.ROWS; r++) {
          for (let c = 0; c < CONFIG.COLS; c++) {
            const tile = this.state.board[r][c];
            if (tile && tile.yOffset < 0) {
              tile.yOffset += CONFIG.TILE_SIZE / totalSteps;
              if (tile.yOffset > 0) tile.yOffset = 0;
              hasOffset = true;
            }
          }
        }
        this.render();
        if (step >= totalSteps || !hasOffset) {
          clearInterval(interval);
          for (let r = 0; r < CONFIG.ROWS; r++) {
            for (let c = 0; c < CONFIG.COLS; c++) {
              if (this.state.board[r][c]) this.state.board[r][c].yOffset = 0;
            }
          }
          this.render();
          resolve();
        }
      }, 20);
    });
  }

  endTurn() {
    this.state.remainingTurns--;
    this.state.enemyCd--;
    this.state.elapsedTurns++;

    if (this.state.cabinetDecisionTurns > 0) {
      this.state.cabinetDecisionTurns--;
    }

    for (let r = 0; r < CONFIG.ROWS; r++) {
      for (let c = 0; c < CONFIG.COLS; c++) {
        const t = this.state.board[r][c];
        if (t && t.propagandaTimer > 0) {
          t.propagandaTimer--;
          if (t.propagandaTimer === 0 && t.type === "FAKE") {
            t.type = t.originalType || this.getRandomDropType();
            delete t.originalType;
          }
        }
      }
    }

    this.damagePlayer(this.state.baseDecayRate);

    const buffs = this.calculateBuffs();

    if (buffs.lawyerCount > 0) {
      const resolved = this.resolveLawyerSkill(buffs.lawyerCount);
      if (resolved > 0) {
        this.showSkillBanner("社会正義の実現", `非開示・虚偽を${resolved}マス解除`);
      }
    }

    if (buffs.bribedReporterCount > 0) {
      const corrupted = this.corruptQuestions(buffs.bribedReporterCount);
      if (corrupted > 0) {
        this.showSkillBanner("情報操作(買収)", "「疑問💬」を「虚偽」または「非開示」に悪化");
      }
    }

    if (this.state.enemyCd <= 0) {
      const enemy = this.enemies[this.state.currentEnemyIdx];
      if (enemy.action()) {
        this.showSkillBanner(enemy.skillName, enemy.desc);
      }
      this.setupEnemy(this.state.currentEnemyIdx);
    }

    this.updateUI();
    this.render();

    if (this.state.oppressionHp <= 0) {
      this.showResultModal(true, "【透明性の確保】<br>抑圧を打ち破り、健全な議論の場が取り戻されました。<br>さあ、次は画面の外で。");
    } else if (this.state.playerHp <= 0) {
      this.showResultModal(false, "【あきらめの連鎖】<br>市民の気力が尽き、社会への無関心が定着してしまいました。");
    } else if (this.state.remainingTurns <= 0) {
      this.showResultModal(false, "【抑圧の継続】<br>声は日常の雑音へと消え、誰も何も語らなくなりました。");
    }
  }

  resolveLawyerSkill(count) {
    const targets = [];
    for (let r = 0; r < CONFIG.ROWS; r++) {
      for (let c = 0; c < CONFIG.COLS; c++) {
        const t = this.state.board[r][c];
        if (t.blackout) targets.push({ type: 'blackout', tile: t });
        else if (t.type === 'FAKE') targets.push({ type: 'fake', tile: t });
      }
    }
    if (targets.length === 0) return 0;

    targets.sort(() => Math.random() - 0.5);
    const limit = Math.min(count, targets.length);
    for (let i = 0; i < limit; i++) {
      if (targets[i].type === 'blackout') targets[i].tile.blackout = false;
      else targets[i].tile.type = this.getRandomDropType();
    }
    return limit;
  }

  convertAllQuestionsToAction() {
    const questions = [];
    for (let r = 0; r < CONFIG.ROWS; r++) {
      for (let c = 0; c < CONFIG.COLS; c++) {
        const t = this.state.board[r][c];
        if (t && t.type === "QUESTION" && !t.blackout) questions.push(t);
      }
    }
    questions.forEach(t => t.type = Math.random() < 0.5 ? "SIGN" : "DEMO");
    return questions.length;
  }

  corruptQuestions(count) {
    const questions = [];
    for (let r = 0; r < CONFIG.ROWS; r++) {
      for (let c = 0; c < CONFIG.COLS; c++) {
        const t = this.state.board[r][c];
        if (t && t.type === "QUESTION" && !t.blackout) questions.push(t);
      }
    }
    if (questions.length === 0) return 0;

    questions.sort(() => Math.random() - 0.5);
    const limit = Math.min(count, questions.length);
    for (let i = 0; i < limit; i++) {
      if (Math.random() < 0.5) questions[i].type = "FAKE";
      else questions[i].blackout = true;
    }
    return limit;
  }

  convertQuestionToFake() {
    let changed = 0;
    for (let r = 0; r < CONFIG.ROWS; r++) {
      for (let c = 0; c < CONFIG.COLS; c++) {
        const t = this.state.board[r][c];
        if (t && t.type === "QUESTION" && !t.blackout) {
          t.type = "FAKE";
          changed++;
        }
      }
    }
    return changed;
  }

  convertReportToFakeAndBlackout() {
    let changed = 0;
    for (let r = 0; r < CONFIG.ROWS; r++) {
      for (let c = 0; c < CONFIG.COLS; c++) {
        const t = this.state.board[r][c];
        if (t && t.type === "REPORT" && !t.blackout) {
          if (Math.random() < 0.5) t.type = "FAKE";
          else t.blackout = true;
          changed++;
        }
      }
    }
    return changed;
  }

  cleanseFakeTiles(count) {
    const fakes = [];
    for (let r = 0; r < CONFIG.ROWS; r++) {
      for (let c = 0; c < CONFIG.COLS; c++) {
        const t = this.state.board[r][c];
        if (t && t.type === "FAKE" && !t.blackout) fakes.push(t);
      }
    }
    const limit = Math.min(count, fakes.length);
    for (let i = 0; i < limit; i++) {
      fakes[i].type = "QUESTION";
    }
    return limit;
  }

  revealBlackout() {
    const blackouts = [];
    for (let r = 0; r < CONFIG.ROWS; r++) {
      for (let c = 0; c < CONFIG.COLS; c++) {
        if (this.state.board[r][c].blackout) blackouts.push(this.state.board[r][c]);
      }
    }
    if (blackouts.length === 0) return 0;

    const minCount = Math.min(2, blackouts.length);
    const count = Math.floor(Math.random() * (blackouts.length - minCount + 1)) + minCount;
    blackouts.sort(() => Math.random() - 0.5);

    for (let i = 0; i < count; i++) {
      blackouts[i].blackout = false;
    }
    return count;
  }

  applyBlackout(count) {
    const targets = [];
    for (let r = 0; r < CONFIG.ROWS; r++) {
      for (let c = 0; c < CONFIG.COLS; c++) {
        if (!this.state.board[r][c].blackout) targets.push(this.state.board[r][c]);
      }
    }
    if (targets.length === 0) return 0;

    targets.sort(() => Math.random() - 0.5);
    const limit = Math.min(count, targets.length);
    for (let i = 0; i < limit; i++) {
      targets[i].blackout = true;
    }
    return limit;
  }

  applyPropaganda() {
    const startR = Math.floor(Math.random() * (CONFIG.ROWS - 2));
    const startC = Math.floor(Math.random() * (CONFIG.COLS - 2));
    let changed = 0;

    for (let r = startR; r < startR + 3; r++) {
      for (let c = startC; c < startC + 3; c++) {
        const t = this.state.board[r][c];
        if (t && t.type !== "FAKE") {
          t.originalType = t.type;
          t.type = "FAKE";
          t.propagandaTimer = 2;
          changed++;
        }
      }
    }
    return changed;
  }

  damagePlayer(amount) {
    this.state.playerHp = Math.max(0, this.state.playerHp - amount);
  }

  bribeMember() {
    const unbribed = [];
    this.state.party.forEach((_, idx) => {
      if (!this.state.bribedMembers[idx]) unbribed.push(idx);
    });
    if (unbribed.length > 0) {
      const targetIdx = unbribed[Math.floor(Math.random() * unbribed.length)];
      this.state.bribedMembers[targetIdx] = true;
      return true;
    }
    return false;
  }

  restoreBribedMember() {
    const bribed = [];
    this.state.party.forEach((_, idx) => {
      if (this.state.bribedMembers[idx]) bribed.push(idx);
    });
    if (bribed.length > 0) {
      const targetIdx = bribed[Math.floor(Math.random() * bribed.length)];
      this.state.bribedMembers[targetIdx] = false;
      return true;
    }
    return false;
  }

  shuffleBoard() {
    let isValid = false;
    while (!isValid) {
      for (let r = 0; r < CONFIG.ROWS; r++) {
        for (let c = 0; c < CONFIG.COLS; c++) {
          this.state.board[r][c].type = this.getRandomDropType();
        }
      }
      if (this.findMatches().length === 0) isValid = true;
    }
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const { isDragging, startTile, dragPos } = this.state.dragState;

    for (let r = 0; r < CONFIG.ROWS; r++) {
      for (let c = 0; c < CONFIG.COLS; c++) {
        if (isDragging && startTile.r === r && startTile.c === c) continue;
        this.drawTile(r, c, this.state.board[r][c], c * CONFIG.TILE_SIZE, r * CONFIG.TILE_SIZE + (this.state.board[r][c].yOffset || 0));
      }
    }

    if (isDragging) {
      const tile = this.state.board[startTile.r][startTile.c];
      this.drawTile(startTile.r, startTile.c, tile, dragPos.x - CONFIG.TILE_SIZE / 2, dragPos.y - CONFIG.TILE_SIZE / 2, true);
    }

    this.renderPopups();
  }

  drawTile(r, c, tile, x, y, isDragged = false) {
    const ts = CONFIG.TILE_SIZE;
    this.ctx.save();
    this.ctx.translate(x + ts / 2, y + ts / 2);
    if (tile.scale) this.ctx.scale(tile.scale, tile.scale);
    this.ctx.translate(-ts / 2, -ts / 2);

    const dropData = DROPS[tile.type];

    if (tile.blackout) {
      this.ctx.fillStyle = "#212529";
      this.ctx.beginPath();
      this.ctx.roundRect(3, 3, ts - 6, ts - 6, 8);
      this.ctx.fill();
      this.ctx.fillStyle = "#ffffff";
      this.ctx.font = "bold 11px sans-serif";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText("非開示", ts / 2, ts / 2);
    } else {
      this.ctx.fillStyle = isDragged ? "#ffffff" : (dropData ? dropData.bg : "#eee");
      this.ctx.strokeStyle = dropData ? dropData.border : "#ccc";
      this.ctx.lineWidth = isDragged ? 3 : 2;

      this.ctx.beginPath();
      this.ctx.roundRect(3, 3, ts - 6, ts - 6, 8);
      this.ctx.fill();
      this.ctx.stroke();

      if (tile.type === "FAKE") {
        this.ctx.font = "bold 16px sans-serif";
        this.ctx.fillStyle = "#59359a";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText("虚偽", ts / 2, ts / 2);
      } else {
        this.ctx.font = "28px serif";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(dropData ? dropData.symbol : "❓", ts / 2, ts / 2);
      }
    }
    this.ctx.restore();
  }

  renderPopups() {
    for (let i = this.state.popups.length - 1; i >= 0; i--) {
      const p = this.state.popups[i];
      p.timer--;
      p.y -= 0.8;

      if (p.timer <= 0) {
        this.state.popups.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, p.timer / 12);
      this.ctx.font = "bold 14px sans-serif";
      this.ctx.fillStyle = "#d90429";
      this.ctx.textAlign = "center";
      this.ctx.fillText(p.text1, p.x, p.y);

      this.ctx.font = "bold 11px sans-serif";
      this.ctx.fillStyle = "#000000";
      this.ctx.fillText(p.text2, p.x, p.y + 14);
      this.ctx.restore();
    }
  }

  updateUI() {
    document.getElementById("rem-turns").innerText = this.state.remainingTurns;
    document.getElementById("score-display").innerText = this.state.score;
    document.getElementById("player-hp").style.width = `${this.state.playerHp}%`;
    document.getElementById("player-hp-text").innerText = `気力 ${this.state.playerHp} / ${CONFIG.MAX_PLAYER_HP}`;

    const currentEnemy = this.enemies[this.state.currentEnemyIdx];
    document.getElementById("enemy-turn-info").innerHTML = 
      `${this.state.enemyCd}ターン後 ${currentEnemy.name}【<strong>${currentEnemy.skillName}</strong>】<br><span style="font-size:0.7rem; color:#666;">（${currentEnemy.desc}）</span>`;
    
    document.getElementById("oppression-hp").style.width = `${(this.state.oppressionHp / CONFIG.MAX_OPPRESSION) * 100}%`;
    document.getElementById("oppression-hp-text").innerText = `抑圧度 ${this.state.oppressionHp} / ${CONFIG.MAX_OPPRESSION}`;

    this.renderPartyDisplay();
    this.renderBuffDetails();
  }

  renderPartyDisplay() {
    const container = document.getElementById("party-display");
    container.innerHTML = "";
    this.state.party.forEach((id, idx) => {
      const job = JOBS.find(j => j.id === id);
      const icon = job.icons[this.state.partyIconIndices[idx] % job.icons.length];
      const div = document.createElement("div");
      div.className = "party-member-card" + (this.state.bribedMembers[idx] ? " bribed" : "");
      div.innerHTML = `<div class="member-icon">${icon}</div><div>${job.name}</div>`;
      container.appendChild(div);
    });
  }

  renderBuffDetails() {
    const buffs = this.calculateBuffs();
    const descLines = [];

    if (buffs.citizenCount > 0 && buffs.professionTypeCount > 0) {
      descLines.push(`署名・デモ威力 ${buffs.signDemoPower}pt`);
    } else if (buffs.citizenCount > 0 || buffs.professionTypeCount > 0) {
      descLines.push(`署名・デモ威力 0pt`);
    }

    if (buffs.lawyerCount > 0) descLines.push(`毎T非開示/虚偽解除`);
    if (buffs.reporterCount > 0) descLines.push(`報道4消しで疑問変換`);
    if (buffs.expertCount > 0) descLines.push(`検証強化/コンボ+`);
    if (buffs.healMult !== 1.0) {
      const percent = Math.round((buffs.healMult - 1) * 100);
      descLines.push(`回復${percent >= 0 ? '+' : ''}${percent}%`);
    }

    document.getElementById("buff-detail-text").innerText = "効果: " + (descLines.length > 0 ? descLines.join(" / ") : "なし（基礎状態）");
  }

  showSkillBanner(skillName, desc) {
    const banner = document.getElementById("skill-banner");
    banner.innerHTML = `スキル発動<br>【${skillName}】<span class="skill-effect-text">${desc}</span>`;
    banner.style.display = "block";
    setTimeout(() => { banner.style.display = "none"; }, 1200);
  }

  showResultModal(isWin, message) {
    this.state.lastResult = { isWin, score: this.state.score, remTurns: this.state.remainingTurns };
    document.getElementById("modal-title").innerText = isWin ? "クリア" : "ゲームオーバー";
    document.getElementById("modal-body").innerHTML = `${message}<br><br>スコア: <strong>${this.state.score}</strong> pt<br>残りターン: <strong>${this.state.remainingTurns}</strong>`;
    
    document.getElementById("btn-result-restart").innerText = isWin ? "もう一度プレイ" : "あきらめない";
    document.getElementById("result-modal").style.display = "flex";
  }

  getShareText() {
    const { isWin, score, remTurns } = this.state.lastResult;
    const statusText = isWin ? "【クリア】健全な議論の場が取り戻されました" : "【ゲームオーバー】社会の無関心に呑み込まれました…";
    return `【Democracy Match】\n${statusText}\nスコア: ${score} pt / 残りターン: ${remTurns}\n`;
  }

  shareToX() {
    const gameUrl = "https://akmstomdtugzims.github.io/democracy/";
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(this.getShareText())}&url=${encodeURIComponent(gameUrl)}`;
    window.open(tweetUrl, "_blank");
  }

  async shareOther() {
    const gameUrl = "https://akmstomdtugzims.github.io/democracy/";
    const shareData = { title: "Democracy Match", text: this.getShareText(), url: gameUrl };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {}
    } else {
      try {
        await navigator.clipboard.writeText(`${shareData.text}${gameUrl}`);
        alert("結果のテキストとリンクをクリップボードにコピーしました！");
      } catch (err) {
        alert("お使いのブラウザは共有に対応していません。");
      }
    }
  }

  openPartyModal() {
    this.state.selectedSlot = 0;
    this.renderPartyModalSlots();
    this.renderPartyModalJobList();
    document.getElementById("party-modal").style.display = "flex";
  }

  closePartyModal() {
    document.getElementById("party-modal").style.display = "none";
    this.updateUI();
    this.render();
  }

  renderPartyModalSlots() {
    const container = document.getElementById("modal-slots");
    container.innerHTML = "";
    this.state.party.forEach((id, idx) => {
      const job = JOBS.find(j => j.id === id);
      const icon = job ? job.icons[this.state.partyIconIndices[idx] % job.icons.length] : "❓";

      const wrapper = document.createElement("div");
      wrapper.className = "select-slot-wrapper";

      const slotDiv = document.createElement("div");
      slotDiv.className = "select-slot" + (this.state.selectedSlot === idx ? " active" : "");
      slotDiv.innerText = icon;
      slotDiv.onclick = () => {
        this.state.selectedSlot = idx;
        this.renderPartyModalSlots();
      };

      const label = document.createElement("div");
      label.className = "slot-job-label";
      label.innerText = job ? job.name : "";

      wrapper.appendChild(slotDiv);
      wrapper.appendChild(label);
      container.appendChild(wrapper);
    });
  }

  renderPartyModalJobList() {
    const container = document.getElementById("modal-job-list");
    container.innerHTML = "";
    JOBS.forEach(job => {
      const item = document.createElement("div");
      item.className = "job-item";
      item.innerHTML = `
        <div class="job-info">
          <div>${job.icons[0]} ${job.name}</div>
          <div style="color:#666; font-size:0.65rem;">${job.desc}</div>
        </div>
      `;
      const btn = document.createElement("button");
      btn.className = "add-btn";
      btn.innerText = "選択";
      btn.onclick = () => {
        const slotIdx = this.state.selectedSlot;
        this.state.party[slotIdx] = job.id;
        this.state.partyIconIndices[slotIdx] = Math.floor(Math.random() * job.icons.length);
        this.renderPartyModalSlots();
      };
      item.appendChild(btn);
      container.appendChild(item);
    });
  }
}

window.addEventListener("DOMContentLoaded", () => {
  new DemocracyMatch();
});
