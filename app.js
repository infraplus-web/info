// 1. ตั้งค่าแผนที่ (เปลี่ยนกลับเป็น OSM ก่อนเพื่อให้ชัวร์ว่าภาพขึ้น)
var map = L.map('map', { zoomControl: false }).setView([13.7563, 100.5018], 10);
L.control.zoom({ position: 'bottomright' }).addTo(map);

// ใช้แผนที่ถนนปกติ (ชัวร์สุด)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
}).addTo(map);

var layerGroups = {}; 

// 2. ฟังก์ชันเดาชื่ออัจฉริยะ (แก้ปัญหา "ไม่มีชื่อ")
function getSmartName(properties) {
    if (!properties) return "ไม่มีข้อมูล";
    
    // 2.1 ลองหาจากคีย์ยอดฮิต
    var keys = ['name', 'NAME', 'Name', 'title', 'label', 'LABEL', 'id', 'ID', 'road', 'ROAD'];
    for (var i = 0; i < keys.length; i++) {
        if (properties[keys[i]]) return properties[keys[i]];
    }

    // 2.2 ถ้าไม่เจอเลย ให้เอา "ค่าแรกที่เป็นตัวหนังสือ" มาโชว์
    for (var key in properties) {
        if (typeof properties[key] === 'string' && properties[key].length > 1) {
            return properties[key]; // เจออะไรที่เป็นตัวหนังสือ เอาอันนั้นแหละ!
        }
    }
    
    return "รายการแบบไม่มีชื่อ";
}

// 3. ฟังก์ชันนำเข้าไฟล์
document.getElementById('fileInput').addEventListener('change', function(e) {
    var file = e.target.files[0];
    if (!file) return;
    var fileName = file.name.replace(/\.[^/.]+$/, ""); // ตัดนามสกุลออก
    var reader = new FileReader();

    reader.onload = function(event) {
        try {
            var data = JSON.parse(event.target.result);
            createLayerGroup(fileName, data);
        } catch (err) {
            alert("ไฟล์เสียหรือรูปแบบไม่ถูกต้อง");
        }
    };
    reader.readAsText(file);
    this.value = '';
});

// 4. สร้าง Group Layer
function createLayerGroup(groupName, geoJsonData) {
    var leafletGroup = L.geoJSON(geoJsonData, {
        onEachFeature: function(feature, layer) {
            // ผูก Event คลิกเพื่อดูรูป
            layer.on('click', function(e) {
                L.DomEvent.stopPropagation(e);
                var props = feature.properties || {};
                var name = getSmartName(props);
                
                // เปิด Street View
                var latlng = e.latlng || layer.getBounds().getCenter();
                showStreetView(latlng, name);
                
                // Popup เล็กๆ บนแผนที่
                layer.bindPopup("<b>" + name + "</b>").openPopup();
            });
        }
    }).addTo(map);

    var groupId = 'group_' + new Date().getTime();
    layerGroups[groupId] = leafletGroup;

    // สร้าง Sidebar
    var container = document.getElementById('layer-container');
    var groupDiv = document.createElement('div');
    groupDiv.className = 'layer-group';
    groupDiv.innerHTML = `
        <div class="layer-header">
            <input type="checkbox" checked onchange="toggleGroup('${groupId}', this.checked)">
            <span class="layer-title">📂 ${groupName}</span>
        </div>
        <ul class="feature-list" id="list-${groupId}"></ul>
    `;
    container.appendChild(groupDiv);

    // สร้างรายการย่อย
    var listUl = groupDiv.querySelector(`#list-${groupId}`);
    leafletGroup.eachLayer(function(layer) {
        var props = layer.feature.properties || {};
        var name = getSmartName(props); // ใช้ฟังก์ชันเดาชื่อ
        var icon = (layer instanceof L.Marker) ? '📍' : '🛤️';

        var li = document.createElement('li');
        li.className = 'feature-item';
        li.innerHTML = `<span class="feature-icon">${icon}</span> <span>${name}</span>`;
        
        li.onclick = function() {
            if (layer.getBounds) map.fitBounds(layer.getBounds());
            else { map.panTo(layer.getLatLng()); map.setZoom(18); }
            layer.fire('click'); // สั่งให้เหมือนคลิกบนแผนที่
        };
        listUl.appendChild(li);
    });

    // ซูมไปหาข้อมูลที่เพิ่งนำเข้า
    if (leafletGroup.getLayers().length > 0) {
        map.fitBounds(leafletGroup.getBounds());
    }
}

window.toggleGroup = function(id, checked) {
    if (checked) map.addLayer(layerGroups[id]);
    else map.removeLayer(layerGroups[id]);
};

// 5. Street View Function (Mapillary)
function showStreetView(latlng, title) {
    var panel = document.getElementById('street-view-panel');
    var img = document.getElementById('sv-image');
    
    panel.style.display = 'flex';
    document.querySelector('.sv-header span').innerText = title || "Street View";
    img.src = ""; // เคลียร์รูปเก่า

    var token = 'MLY|25589789454017833|bf665b64d332332cc14bc428b9f1d210';
    var url = `https://graph.mapillary.com/images?access_token=${token}&fields=thumb_1024_url&limit=1&closeto=${latlng.lng},${latlng.lat}`;

    fetch(url).then(r => r.json()).then(d => {
        if (d.data && d.data.length > 0) {
            img.src = d.data[0].thumb_1024_url;
        } else {
            alert("จุดนี้ไม่มีภาพ Street View ค่ะ");
            panel.style.display = 'none';
        }
    });
}

window.closeStreetView = function() {
    document.getElementById('street-view-panel').style.display = 'none';
};