const API_BASE_URL = window.AUTOMATION_PYBOT_API_URL || "http://127.0.0.1:8000";
const form = document.querySelector("#students-form");
const daySelect = document.querySelector("#day");
const hourSelect = document.querySelector("#hour");
const searchButton = document.querySelector("#search-button");
const retryButton = document.querySelector("#retry-button");
const studentList = document.querySelector("#student-list");
const studentCount = document.querySelector("#student-count");
const statusMessage = document.querySelector("#status");
const selectionActions = document.querySelector("#selection-actions");
const selectAll = document.querySelector("#select-all");
const selectionCount = document.querySelector("#selection-count");
const sendAbsenceButton = document.querySelector("#send-absence-button");
const dayLabels = {
    monday: "Segunda-feira",
    tuesday: "Terça-feira",
    wednesday: "Quarta-feira",
    thursday: "Quinta-feira",
    friday: "Sexta-feira",
    saturday: "Sábado",
};
let currentStudents = [];
let isLoadingStudents = false;
let isSendingAbsenceNotices = false;

async function requestJson(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 10000);
    let response;

    try {
        response = await fetch(url, {
            ...options,
            headers: { Accept: "application/json", ...options.headers },
            signal: controller.signal,
        });
    } catch {
        if (controller.signal.aborted) {
            throw new Error("A conexão com o backend excedeu o tempo limite.");
        }
        throw new Error(
            `Não foi possível conectar a ${API_BASE_URL}. Verifique se o backend está ativo e se a origem do front-end está liberada em FRONTEND_ORIGINS. Sirva esta página em http://localhost:5173 ou http://localhost:3000; evite abri-la como arquivo file://.`
        );
    } finally {
        window.clearTimeout(timeoutId);
    }

    let data;
    try {
        data = await response.json();
    } catch {
        throw new Error(`O backend respondeu com HTTP ${response.status}, mas não retornou JSON válido.`);
    }
    return { response, data };
}

async function fetchJson(url) {
    const { response, data } = await requestJson(url);
    if (!response.ok) {
        throw new Error(
            data && typeof data.error === "string"
                ? data.error
                : `O backend respondeu com HTTP ${response.status}.`
        );
    }
    return data;
}

async function fetchDays() {
    const data = await fetchJson(new URL("/api/days", API_BASE_URL));
    if (!data || !Array.isArray(data.days)) {
        throw new Error("A resposta do backend não contém uma lista válida de dias.");
    }

    const days = data.days.map((day) => {
        if (typeof day === "string" && dayLabels[day]) {
            return { key: day, label: dayLabels[day] };
        }
        if (day && typeof day.key === "string" && typeof day.label === "string" &&
            dayLabels[day.key] && day.label.trim()) {
            return { key: day.key, label: day.label };
        }
        throw new Error("A lista de dias retornada pelo backend contém dados inválidos.");
    });

    if (!days.length || new Set(days.map(({ key }) => key)).size !== days.length) {
        throw new Error("A lista de dias retornada pelo backend está vazia ou contém dias repetidos.");
    }
    return days;
}

async function fetchStudents(day) {
    const url = new URL("/api/students", API_BASE_URL);
    url.searchParams.set("day", day);
    return fetchJson(url);
}

function clearResults() {
    studentList.replaceChildren();
    currentStudents = [];
    studentCount.textContent = "";
    selectionActions.hidden = true;
    selectAll.checked = false;
    selectAll.indeterminate = false;
    sendAbsenceButton.disabled = true;
}

function setBusyState() {
    const busy = isLoadingStudents || isSendingAbsenceNotices;
    daySelect.disabled = busy;
    hourSelect.disabled = busy;
    searchButton.disabled = busy || daySelect.options.length === 1;
    retryButton.disabled = busy;
    for (const checkbox of studentList.querySelectorAll(".student-select")) {
        checkbox.disabled = busy || checkbox.dataset.noTelephone === "true";
    }
    updateSelectionControls();
}

async function initializeDays() {
    daySelect.disabled = true;
    hourSelect.disabled = true;
    searchButton.disabled = true;
    retryButton.hidden = true;
    statusMessage.classList.remove("error", "warning");
    statusMessage.textContent = "Carregando dias disponíveis...";

    try {
        const days = await fetchDays();
        daySelect.replaceChildren(daySelect.options[0]);
        for (const day of days) {
            const option = document.createElement("option");
            option.value = day.key;
            option.textContent = day.label;
            daySelect.append(option);
        }
        statusMessage.textContent = "Escolha um dia e horário para começar.";
        daySelect.disabled = false;
        hourSelect.disabled = false;
        searchButton.disabled = false;
    } catch (error) {
        statusMessage.classList.add("error");
        statusMessage.textContent = `Não foi possível carregar os dias. ${
            error instanceof Error ? error.message : "Ocorreu um erro inesperado."
        }`;
        retryButton.hidden = false;
        retryButton.disabled = false;
    }
}

async function loadStudents() {
    const day = daySelect.value;
    const hour = hourSelect.value;
    if (!day || !hour || isLoadingStudents || isSendingAbsenceNotices) {
        return;
    }

    isLoadingStudents = true;
    clearResults();
    statusMessage.classList.remove("error", "warning");
    statusMessage.textContent = "Carregando alunos...";
    retryButton.hidden = true;
    setBusyState();

    try {
        const data = await fetchStudents(day);
        if (!data || data.day !== day) {
            throw new Error(
                `O backend recebeu a consulta de ${day}, mas retornou dados de ${data?.day ?? "um dia desconhecido"}.`
            );
        }
        if (!data.hours || typeof data.hours !== "object" || Array.isArray(data.hours)) {
            throw new Error("O backend não retornou uma lista válida de horários.");
        }

        const students = data.hours[hour];
        if (!Array.isArray(students)) {
            throw new Error(`O backend não retornou uma lista válida de alunos para ${hour}.`);
        }
        for (const student of students) {
            if (!student || typeof student.name !== "string" ||
                !(student.telephone === null ||
                    (typeof student.telephone === "string" && /^\d+$/.test(student.telephone)))) {
                throw new Error("A resposta do backend contém um aluno com dados inválidos.");
            }
        }

        currentStudents = students;
        students.forEach((student, index) => {
            const item = document.createElement("li");
            const label = document.createElement("label");
            label.className = "student-option";

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.className = "student-select";
            checkbox.dataset.studentIndex = String(index);
            checkbox.dataset.noTelephone = String(student.telephone === null);
            checkbox.disabled = student.telephone === null;

            const details = document.createElement("span");
            details.className = "student-details";
            const name = document.createElement("span");
            name.textContent = student.name;
            details.append(name);

            if (student.telephone === null) {
                const note = document.createElement("span");
                note.className = "student-telephone-note";
                note.textContent = "Sem telefone cadastrado — não pode receber aviso";
                details.append(note);
            }

            label.append(checkbox, details);
            item.append(label);
            studentList.append(item);
        });

        selectionActions.hidden = students.length === 0;
        selectAll.checked = false;
        selectAll.indeterminate = false;
        studentCount.textContent = `${students.length} ${students.length === 1 ? "aluno" : "alunos"}`;
        statusMessage.textContent = students.length
            ? `Turma de ${daySelect.options[daySelect.selectedIndex].text} às ${hour}.`
            : "Nenhum aluno cadastrado para esse horário.";
    } catch (error) {
        statusMessage.classList.add("error");
        statusMessage.textContent = `Não foi possível carregar os alunos. ${
            error instanceof Error ? error.message : "Ocorreu um erro inesperado."
        }`;
        retryButton.hidden = false;
        retryButton.disabled = false;
    } finally {
        isLoadingStudents = false;
        setBusyState();
    }
}

function updateSelectionControls() {
    const checkboxes = [...studentList.querySelectorAll(".student-select")];
    const eligible = checkboxes.filter((checkbox) => checkbox.dataset.noTelephone !== "true");
    const selected = eligible.filter((checkbox) => checkbox.checked);
    selectAll.checked = eligible.length > 0 && selected.length === eligible.length;
    selectAll.indeterminate = selected.length > 0 && selected.length < eligible.length;
    selectAll.disabled = isLoadingStudents || isSendingAbsenceNotices || eligible.length === 0;
    selectionCount.textContent = `${selected.length} selecionado${selected.length === 1 ? "" : "s"}`;
    sendAbsenceButton.disabled = isLoadingStudents || isSendingAbsenceNotices || selected.length === 0;
}

studentList.addEventListener("change", (event) => {
    if (event.target instanceof HTMLInputElement && event.target.matches(".student-select")) {
        updateSelectionControls();
    }
});

selectAll.addEventListener("change", () => {
    for (const checkbox of studentList.querySelectorAll(".student-select")) {
        if (checkbox.dataset.noTelephone !== "true") {
            checkbox.checked = selectAll.checked;
        }
    }
    updateSelectionControls();
});

async function sendAbsenceNotices() {
    const selectedCheckboxes = [...studentList.querySelectorAll(".student-select:checked")];
    const students = selectedCheckboxes.map((checkbox) =>
        currentStudents[Number(checkbox.dataset.studentIndex)]
    );
    if (!students.length || students.some((student) => !student || student.telephone === null)) {
        return;
    }

    isSendingAbsenceNotices = true;
    statusMessage.classList.remove("error", "warning");
    statusMessage.textContent = "Enviando avisos para os alunos selecionados...";
    setBusyState();

    try {
        const url = new URL("/api/messages/absence", API_BASE_URL);
        const { response, data } = await requestJson(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                day: daySelect.value,
                hour: hourSelect.value,
                students: students.map(({ name, telephone }) => ({ name, telephone })),
            }),
        });

        if (!data || !Array.isArray(data.results) || data.results.length !== students.length ||
            data.results.some((result) =>
                !result || typeof result.name !== "string" ||
                typeof result.telephone !== "string" ||
                !["sent", "failed"].includes(result.status)
            )) {
            throw new Error(
                data && typeof data.error === "string"
                    ? data.error
                    : `O backend respondeu com HTTP ${response.status}, sem um resultado válido para cada aviso.`
            );
        }

        showDeliveryResults(data.results, selectedCheckboxes);
        const sent = data.results.filter((result) => result.status === "sent").length;
        const failed = data.results.length - sent;
        if (!response.ok || failed > 0 || data.status === "partial_failure") {
            statusMessage.classList.add("warning");
            const detail = typeof data.error === "string" && data.error ? ` ${data.error}` : "";
            statusMessage.textContent =
                `Envio parcial: ${sent} enviado(s), ${failed} com falha. Os recebidos foram desmarcados; somente os que falharam continuam selecionados. Não houve repetição automática.${detail}`;
        } else if (data.status === "sent") {
            statusMessage.textContent = `${sent} aviso(s) enviado(s) com sucesso.`;
        } else {
            throw new Error("O backend retornou um estado de envio desconhecido.");
        }
    } catch (error) {
        statusMessage.classList.add("error");
        statusMessage.textContent = `Não foi possível confirmar o envio. ${
            error instanceof Error ? error.message : "Ocorreu um erro inesperado."
        } Verifique o resultado antes de tentar novamente para evitar mensagens duplicadas.`;
    } finally {
        isSendingAbsenceNotices = false;
        setBusyState();
    }
}

function showDeliveryResults(results, selectedCheckboxes) {
    const rowsByStudent = new Map();
    for (const checkbox of selectedCheckboxes) {
        const student = currentStudents[Number(checkbox.dataset.studentIndex)];
        const key = `${student.name}\u0000${student.telephone}`;
        const entries = rowsByStudent.get(key) ?? [];
        entries.push({
            row: studentList.children[Number(checkbox.dataset.studentIndex)],
            checkbox,
        });
        rowsByStudent.set(key, entries);
    }

    for (const result of results) {
        const key = `${result.name}\u0000${result.telephone}`;
        const entry = rowsByStudent.get(key)?.shift();
        if (!entry?.row) {
            continue;
        }
        entry.row.querySelector(".delivery-status")?.remove();
        const deliveryStatus = document.createElement("span");
        deliveryStatus.className = `delivery-status ${result.status === "sent" ? "sent" : "failed"}`;
        deliveryStatus.textContent = result.status === "sent"
            ? "Aviso enviado"
            : typeof result.error === "string" && result.error
                ? `Falha: ${result.error}`
                : "Falha no envio";
        entry.row.append(deliveryStatus);
        if (result.status === "sent") {
            entry.checkbox.checked = false;
        }
    }
}

form.addEventListener("submit", (event) => {
    event.preventDefault();
    loadStudents();
});

retryButton.addEventListener("click", () => {
    if (daySelect.options.length === 1) {
        initializeDays();
    } else {
        loadStudents();
    }
});

function resetSearchResults() {
    clearResults();
    statusMessage.classList.remove("error", "warning");
    statusMessage.textContent = "Clique em Buscar alunos para consultar essa turma.";
    retryButton.hidden = true;
}

daySelect.addEventListener("change", resetSearchResults);
hourSelect.addEventListener("change", resetSearchResults);
sendAbsenceButton.addEventListener("click", sendAbsenceNotices);
initializeDays();
