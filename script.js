let wordIndexToDelete = null;

//Traduções
const fallbackGoogleTranslation = async (text) => {
  try {
    const url = `https://cors-anywhere.herokuapp.com/https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=pt&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url);
    const data = await response.json();
    return data[0][0][0] || "(tradução indisponível)";
  } catch (error) {
    console.error("Erro com Google Translate:", error);
    return "(tradução indisponível)";
  }
};

const fetchTranslation = async (originalWord) => {
  try {
    const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(originalWord)}&langpair=en|pt`);
    const data = await response.json();

    if (
      data?.responseData?.translatedText &&
      !data?.responseData?.translatedText.includes("MYMEMORY WARNING")
    ) {
      return data.responseData.translatedText;
    } else {
      console.warn("MyMemory bloqueado. Usando Google.");
      return await fallbackGoogleTranslation(originalWord);
    }
  } catch (error) {
    console.error("Erro com MyMemory:", error);
    return await fallbackGoogleTranslation(originalWord);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const importBtn = document.getElementById("importBtn");
  const fileInput = document.getElementById("fileInput");

  importBtn.addEventListener("click", () => {
    fileInput.value = "";
    fileInput.click();
  });

  fileInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      const newWords = content.split("\n").map(w => w.trim()).filter(w => w);

      const existingWords = JSON.parse(localStorage.getItem("words")) || [];
      const allWords = [...new Set([...existingWords, ...newWords])];

      localStorage.setItem("words", JSON.stringify(allWords));
      loadWords();

      // Reset o input para permitir reimportar o mesmo arquivo
      fileInput.value = "";
    };

    reader.readAsText(file);
  });

  // Carrega as palavras ao iniciar
  loadWords();
});


// Adiciona evento ao pressionar Enter
document.getElementById("wordInput").addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    //event.preventDefault(); // Evita enviar formulários ou outras ações padrão
    addWord();
  }
});


function listenTo(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  window.speechSynthesis.speak(utterance);
}

async function fetchDefinitionAndShow(word, isTranslation) {
  if (!word || typeof word !== "string" || word.trim() === "") {
    showModal("Erro", `Palavra inválida ou vazia.`, "auto", "flex", "none", "flex");
    console.warn("Palavra inválida ou vazia. Ignorando fetchDefinitionAndShow.");
    return;
  }

  if (isTranslation) {
    showModal("Aviso", "Não é possível buscar significado de palavras em português nesta versão.", "auto", "flex", "none", "flex");
    return;
  }

  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);

    if (!response.ok) {
      console.error(`Erro na requisição para ${word}: ${response.status}`);
      showModal("Erro", `Erro ao buscar definição para "${word}".`, "auto", "flex", "none", "flex");
      return;
    }

    const data = await response.json();
    if (data && data.length > 0) {
      const definitions = data.map(entry => {
        const word = entry.word;
        const phonetic = entry.phonetic || "";
        const meaningsHtml = entry.meanings.map(meaning => {
          const partOfSpeech = meaning.partOfSpeech;
          const defs = meaning.definitions.map(def => def.definition).join("<br>");
          return `<strong>${partOfSpeech}</strong>:<br>${defs}`;
        }).join("<br><br>");

        return `<div style="margin-bottom: 16px;">
                  <div><strong>Palavra:</strong> ${word} ${phonetic ? `(${phonetic})` : ""}</div>
                  ${meaningsHtml}
                </div>`;
      }).join("<hr>"); // separa cada entrada com uma linha

      //showModal(`Definição de "${word}"`, definitions, "900px","none","none","none");
      const listenButton = `
        <button onclick='listenTo(${JSON.stringify(word)})' 
                title="Ouvir palavra"
                style="background: none; border: none; cursor: pointer; margin-left: 8px;">
          <i class="fas fa-volume-up" style="color: #007bff;"></i>
        </button>
      `;

      showModal(
        `Definição de "${word}" ${listenButton}`,
        definitions,
        "900px",
        "none",
        "none",
        "none"
      );

    } else {
      showModal(`Definição de "${word}"`, "Definição não encontrada.", "auto", "flex", "none", "flex");
    }
  } catch (error) {
    console.error("Erro ao buscar definição:", error);
    showModal("Erro", "Erro ao buscar definição.", "auto", "flex", "none", "flex");
  }
}

function showModal(title, content, tamanho, buttons, confirmation, aviso) {
  document.getElementById("modalTitle").innerHTML = title;
  document.getElementById("modalContent").innerHTML = content;
  document.getElementById("modal").style.display = "flex";
  document.getElementById("modal").style.width = tamanho;
  document.getElementById("overlay").style.display = "block";
  document.getElementById("modalButtons").style.display = buttons;
  document.getElementById("confirmYesBtn").style.display = confirmation;
  document.getElementById("confirmNoBtn").style.display = confirmation;
  document.getElementById("confirmOkBtn").style.display = aviso;
}

function hideModal() {
  modal.style.display = "none";
  overlay.style.display = "none";
}

function createWordSpans(word, wordText, isTranslation) {
  wordText.innerHTML = "";

  const wordsInPhrase = word.trim().split(" ");
  wordsInPhrase.forEach((w) => {
    const span = document.createElement("span");
    span.textContent = w + " ";
    span.style.cursor = "pointer";

    let timeout;
    span.addEventListener("mousedown", () => {
      timeout = setTimeout(() => {
        fetchDefinitionAndShow(w, isTranslation);
      }, 600);
    });

    span.addEventListener("mouseup", () => clearTimeout(timeout));
    span.addEventListener("mouseleave", () => clearTimeout(timeout));

    // Suporte a toque em celular
    span.addEventListener("touchstart", () => {
      timeout = setTimeout(() => {
        fetchDefinitionAndShow(w, isTranslation);
      }, 600);
    });
    span.addEventListener("touchend", () => clearTimeout(timeout));
    span.addEventListener("touchmove", () => clearTimeout(timeout)); // se o usuário

    wordText.appendChild(span);
  });
}

async function translateWord(originalWord) {
  try {
    const response = await fetch('https://cors-anywhere.herokuapp.com/https://libretranslate.de/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: originalWord,
        source: 'en',
        target: 'pt',
        format: 'text'
      })
    });

    const rawText = await response.text(); // <- captura o texto bruto
    console.log("Resposta da API:", rawText); // <- veja o que veio realmente

    const data = JSON.parse(rawText); // tenta transformar em JSON
    return data.translatedText;
  } catch (err) {
    console.error('Erro na tradução:', err);
    return null;
  }
}


function loadWords() {
  const words = JSON.parse(localStorage.getItem("words")) || [];
  const container = document.getElementById("wordsContainer");
  container.innerHTML = ""; // Clear container

  // Referências do modal (só uma vez)
  const overlay = document.getElementById("overlay");

  overlay.addEventListener("click", hideModal);

  words.forEach((word, index) => {
    const wordElement = document.createElement("div");
    wordElement.className = "word";

    const wordText = document.createElement("span");
    wordText.style.cursor = "pointer";

    createWordSpans(word, wordText, false);

    let showingOriginal = true;

    wordText.addEventListener("click", async () => {
      // Verifica se já foi carregada antes
      if (!wordText.dataset.translationLoaded) {
        const translated = await fetchTranslation(word);
        wordText.dataset.translated = translated;
        wordText.dataset.translationLoaded = "true";
      }

      const translated = wordText.dataset.translated;

      if (showingOriginal) {
        createWordSpans(translated, wordText, true);
      } else {
        createWordSpans(word, wordText, false);
      }
      showingOriginal = !showingOriginal;
    });

    // Muda o cursor para mãozinha quando o mouse estiver sobre a palavra
    wordText.style.cursor = "pointer";
    // Impede a seleção de texto
    wordText.style.userSelect = "none";


    // Criando o menu de contexto
    const contextMenu = document.createElement("div");
    contextMenu.className = "context-menu";
    contextMenu.style.display = "none"; // Inicialmente invisível

    const editOption = document.createElement("button");
    editOption.innerHTML = '<i class="fas fa-edit"></i>'; // ícone de lápis
    editOption.title = "Edit"; // tooltip ao passar o mouse
    editOption.style.color = "#ffc107";
    editOption.onclick = function () {
      /*const newWord = prompt("Edit the word:", word);
      if (newWord) {
        editWord(index, newWord);
      }*/
      showEditWordModal(word, index);
      contextMenu.style.display = "none"; // Esconde o menu após a ação
    };

    const deleteOption = document.createElement("button");
    deleteOption.innerHTML = '<i class="fas fa-trash"></i>'; // ícone de lixeira
    deleteOption.style.color = "#c82333";
    deleteOption.title = "Delete"; // tooltip ao passar o mouse
    deleteOption.onclick = function () {
      const words = JSON.parse(localStorage.getItem("words")) || [];
      const deletedWord = words[index];

      showModal("Aviso", "Tem certeza que deseja deletar a palavra <b>" + deletedWord + "</b>?", "auto", "flex", "flex", "none");

      const confirmYesBtn = document.getElementById("confirmYesBtn");
      confirmYesBtn.onclick = function () {
        deleteWord(index); // Deleta uma palavra
        loadWords();
        hideModal();
      };

      contextMenu.style.display = "none";
    };

    const copyOption = document.createElement("button");
    copyOption.innerHTML = '<i class="fas fa-copy"></i>'; // ícone de copiar
    copyOption.title = "Copy"; // tooltip ao passar o mouse
    copyOption.style.color = "#28a745";
    copyOption.onclick = function () {
      // Copia o texto para a área de transferência
      navigator.clipboard.writeText(word).then(() => {
        showModal("Aviso", "Word <b>" + word + "</b> copied to clipboard!", "auto", "flex", "none", "flex");
        //alert("Word copied to clipboard!");
      }).catch(err => {
        console.error("Failed to copy text: ", err);
      });
      contextMenu.style.display = "none"; // Esconde o menu após a ação
    };

    // Opção de ler o texto
    const readOption = document.createElement("button");
    readOption.innerHTML = '<i class="fas fa-volume-up"></i>'; // ícone de alto-falante
    readOption.title = "Read"; // tooltip ao passar o mouse
    readOption.style.color = "#007bff";
    readOption.onclick = function () {
      // Usando a SpeechSynthesis API para ler o texto em inglês
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = "en-US"; // Define o idioma para inglês
      window.speechSynthesis.speak(utterance); // Fala o texto

      contextMenu.style.display = "none"; // Esconde o menu após a ação
    };

    contextMenu.appendChild(readOption);
    contextMenu.appendChild(copyOption);
    contextMenu.appendChild(editOption);
    contextMenu.appendChild(deleteOption);
    wordElement.appendChild(wordText);
    wordElement.appendChild(contextMenu);

    // Evento de clique com o botão direito (contextmenu)
    wordText.addEventListener("contextmenu", function (event) {
      event.preventDefault(); // Previne o menu de contexto padrão

      // Faz o menu aparecer na parte de baixo do bloco
      contextMenu.style.display = "flex";
    });

    // Esconde o menu se clicar fora dele
    window.addEventListener("click", function (event) {
      if (!event.target.closest(".context-menu")) {
        contextMenu.style.display = "none";
      }
    });
    container.appendChild(wordElement);
  });
}


function addWord() {
  const input = document.getElementById("wordInput");
  const newWord = input.value.trim();

  if (newWord === "") {
    showModal("Aviso", "Por favor, insira uma palavra!", "auto", "flex", "none", "flex");
    return;
  }

  const words = JSON.parse(localStorage.getItem("words")) || [];
  words.push(newWord);
  localStorage.setItem("words", JSON.stringify(words));

  input.value = ""; // Clear input
  loadWords(); // Refresh the words display
}

function editWord(index, newWord) {
  const words = JSON.parse(localStorage.getItem("words")) || [];
  words[index] = newWord;
  localStorage.setItem("words", JSON.stringify(words));
  loadWords();
}

function deleteWord(index) {
  const words = JSON.parse(localStorage.getItem("words")) || [];
  words.splice(index, 1);
  localStorage.setItem("words", JSON.stringify(words));
  loadWords();
}

function exportWords() {
  const words = JSON.parse(localStorage.getItem("words")) || [];
  const blob = new Blob([words.join("\n")], { type: "text/plain" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "words.txt";
  link.click();
}

function clearAllWords() {
  showModal("Aviso", `Tem certeza que deseja limpar todas as palavras?`, "auto", "flex", "flex", "none");

  const confirmYesBtn = document.getElementById("confirmYesBtn");
  confirmYesBtn.onclick = function () {
    localStorage.removeItem("words"); // Deleta tudo
    loadWords();
    hideModal();
  };
}

function showEditWordModal(word, index) {
  const inputId = "editWordInput";
  const content = `
    <input id="${inputId}" type="text" value="${word}" style="width: 95%; font-size: 16px;">
  `;

  showModal("Editar Palavra", content, "500px", "flex", "flex", "none");

  // Substitui qualquer ação anterior do botão "Sim"
  const confirmYesBtn = document.getElementById("confirmYesBtn");
  confirmYesBtn.onclick = function () {
    const newWord = document.getElementById(inputId).value.trim();
    if (newWord) {
      editWord(index, newWord);
      loadWords(); // Atualiza a lista após editar
    }
    hideModal();
  };
}
