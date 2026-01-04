// Script de prueba para verificar la conexión con el servicio OCR
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const OCR_SERVICE_URL = 'http://localhost:5000';

async function testConnection() {
  console.log('🧪 Probando conexión con servicio OCR...');
  console.log(`🔗 URL: ${OCR_SERVICE_URL}`);
  
  // 1. Probar health check
  console.log('\n1️⃣ Probando /health...');
  try {
    const healthResponse = await axios.get(`${OCR_SERVICE_URL}/health`, {
      timeout: 5000
    });
    console.log('✅ Health check OK:', healthResponse.data);
  } catch (error) {
    console.error('❌ Health check FALLÓ:', error.message);
    console.error('   Código:', error.code);
    return;
  }
  
  // 2. Crear una imagen de prueba (blanco 100x100)
  console.log('\n2️⃣ Creando imagen de prueba...');
  const testImagePath = path.join(__dirname, 'test_image.png');
  
  // Crear una imagen simple usando un buffer (imagen PNG mínima de 1x1 pixel blanco)
  const pngBuffer = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 pixel
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE,
    0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, // IDAT chunk
    0x08, 0xD7, 0x63, 0xF8, 0x00, 0x00, 0x00, 0x00,
    0x01, 0x00, 0x01, 0x5C, 0xC2, 0x8F, 0xA8, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82 // IEND
  ]);
  
  fs.writeFileSync(testImagePath, pngBuffer);
  console.log('✅ Imagen de prueba creada');
  
  // 3. Convertir a base64
  console.log('\n3️⃣ Convirtiendo a base64...');
  const imageBuffer = fs.readFileSync(testImagePath);
  const base64Image = imageBuffer.toString('base64');
  const dataUri = `data:image/png;base64,${base64Image}`;
  console.log(`✅ Base64 creado: ${dataUri.length} caracteres`);
  
  // 4. Enviar al servicio OCR
  console.log('\n4️⃣ Enviando al servicio OCR...');
  try {
    const response = await axios.post(`${OCR_SERVICE_URL}/ocr/process`, {
      image: dataUri
    }, {
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Respuesta recibida:', response.status);
    console.log('📄 Datos:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('❌ Error en OCR:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
    if (error.code) {
      console.error('   Código:', error.code);
    }
  }
  
  // Limpiar
  if (fs.existsSync(testImagePath)) {
    fs.unlinkSync(testImagePath);
  }
  
  console.log('\n✅ Prueba completada');
}

testConnection().catch(console.error);


