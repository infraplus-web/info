let map, currentProjId;
let layerStore = {}; 
let clickMarker = null;
let selectedSubId = null; // เก็บ ID เลเยอร์ที่เลือกไว้

// 1. เริ่มต้นแผนที่
function initMap() {
    if (map) return;
    map = L.map('map', { zoomControl: false }).setView([13.75, 100.5], 10);
    L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        subdomains: ['mt0','mt1','mt2','mt3']
    }).addTo(map);

    map.on('click', e => handleMapClick(e.latlng));
}

// 2. จัดการ Street View และชื่อสถานที่
async function handleMapClick(latlng, manualName) {
    if (clickMarker) map.removeLayer(clickMarker);
    clickMarker = L.marker(latlng).addTo(map);

    // ปรับปรุง Street View: ลบข้อความเก่าและโหลดภาพใหม่
    const svIframe = document.getElementById('sv-iframe');
    svIframe.style.display = 'block';
    svIframe.src = `https://www.google.com/maps/embed/v1/streetview?key=YOUR_API_KEY&location=${latlng.lat},${latlng.lng}`; 
    // หมายเหตุ: ถ้าไม่มี API Key ให้ใช้ URL แบบ embed ปกติได้ตามโค้ดเดิมของคุณ

    // ดึงชื่อสถานที่จริง (Reverse Geocoding)
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latlng.lat}&lon=${latlng.lng}&accept-language=th`);
        const data = await res.json();
        const placeName = manualName || data.display_name;
        clickMarker.bindPopup(`<b>${placeName}</b>`).openPopup();
        updateInfoPanel(placeName, latlng);
    } catch (e) {
        console.error("Geocoding error", e);
    }
}

// 3. ระบบเลือกเลเยอร์ (Active Layer)
function createGroupUI(name) {
    const id = 'g-' + Date.now();
    const subId = 'sub-' + id;
    const div = document.createElement('div');
    div.className = 'layer-group';
    div.innerHTML = `
        <div class="group-header" onclick="setActiveLayer('${subId}', this)">
            <i class="fa-solid fa-folder"></i>
            <span class="group-title">${name}</span>
        </div>
        <div class="sub-items" id="${subId}"></div>
    `;
    document.getElementById('layer-list').appendChild(div);
    return subId;
}

function setActiveLayer(subId, element) {
    document.querySelectorAll('.group-header').forEach(el => el.classList.remove('active-layer-target'));
    element.classList.add('active-layer-target');
    selectedSubId = subId; // ข้อมูลใหม่จะเข้าที่นี่
}

// 4. การนำเข้าข้อมูลหลายรูปแบบ
document.getElementById('fileInput').onchange = function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const targetId = selectedSubId || createGroupUI(file.name.split('.')[0]);
    const reader = new FileReader();
    const ext = file.name.split('.').pop().toLowerCase();

    reader.onload = async (event) => {
        let geojson;
        if (ext === 'zip') {
            geojson = await shp(event.target.result);
        } else if (ext === 'kml') {
            const kml = new DOMParser().parseFromString(event.target.result, 'text/xml');
            geojson = toGeoJSON.kml(kml);
        } else if (ext === 'csv') {
            Papa.parse(event.target.result, {
                header: true,
                complete: (results) => processCSV(results.data, targetId)
            });
            return;
        } else {
            geojson = JSON.parse(event.target.result);
        }
        L.geoJSON(geojson, {
            onEachFeature: (f, l) => setupLayer(l, targetId, f.properties)
        }).addTo(map);
    };

    if (ext === 'zip') reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
};

// 5. ค้นหาด้วย Enter
document.getElementById('search-inp').addEventListener('keypress', e => {
    if (e.key === 'Enter') searchLoc();
});

async function searchLoc() {
    const q = document.getElementById('search-inp').value;
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${q}&accept-language=th`);
    const data = await res.json();
    if (data.length > 0) {
        const loc = data[0];
        const latlng = { lat: parseFloat(loc.lat), lng: parseFloat(loc.lon) };
        map.setView(latlng, 16);
        handleMapClick(latlng, loc.display_name);
    }
}