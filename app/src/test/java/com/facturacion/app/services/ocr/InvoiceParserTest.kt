package com.facturacion.app.services.ocr

import org.junit.Test
import org.junit.Assert.*

/**
 * Tests para verificar el parsing de diferentes formatos de facturas españolas
 */
class InvoiceParserTest {

    @Test
    fun testRamenShifuReceipt() {
        // Texto simulado de la factura Ramen Shifu
        val text = """
            RAMEN SHIFU SEVILLA
            RAMSHI SEVILLA S.L
            CIF: B70674528
            Calle Calatrava 22, Sevilla, 41002
            
            FACTURA
            Nº Op.: F45-2   MESA SVA./6
            11/01/2025  ENCARGADO SEVILLA
            
            Uds.  Producto         Importe
            3     Agua mineral     6,00 €
            1     Age Gyozas       4,95 €
            1     Dragon Ramen     12,95 €
            1     Infierno Ramen   12,95 €
            
            10 %: Base:  33,50 € Cuota: 3,35 €
            Total:  33,50 € Total: 3,35 €
            
            Total (Impuestos Incl.) 36,85 €
        """.trimIndent()

        val result = InvoiceParser.parse(text)

        println("=== Ramen Shifu ===")
        println("Establecimiento: ${result.establishment}")
        println("Fecha: ${result.date}")
        println("Total: ${result.total}")
        println("Subtotal: ${result.subtotal}")
        println("IVA: ${result.tax}")
        println("Tasa IVA: ${result.taxRate?.times(100)}%")
        println("Confianza: ${result.confidence}")

        assertNotNull("Establecimiento no detectado", result.establishment)
        assertNotNull("Fecha no detectada", result.date)
        assertEquals("Total incorrecto", 36.85, result.total ?: 0.0, 0.01)
        assertEquals("Subtotal incorrecto", 33.50, result.subtotal ?: 0.0, 0.01)
        assertEquals("IVA incorrecto", 3.35, result.tax ?: 0.0, 0.01)
    }

    @Test
    fun testLaMafiaReceipt() {
        // Texto simulado de la factura La Mafia
        val text = """
            La Mafia
            SE SIENTA A LA MESA
            
            LA MAFIA 2010 SEVILLA, S.L.
            Plaza del Duque de la Victoria, 11
            41001 - Sevilla
            Teléfono: 954 56 47 29
            NIF: B-91.851.337
            
            Cliente: Federico Ondarts Ondarts
            Otro Documento: Z0641643V
            Dirección: calle peral, 51, 29a
            C.P. 41002
            
            12/01/2025 21:25    Mesa 19
            Factura Simplificada: T295140436    Com: 2
            
            C. CONCEPTO              PRECIO IMPORTE
            2 AGUA                   2,80 €  5,60 €
            1 RAVIOLI CARNE          1,20 €  1,20 €
            1 -QUATTRO FORMAGGIO    15,90 € 15,90 €
            1 SACOTINI PECORINO      1,20 €  1,20 €
            1 -GORGONZOLA           16,00 € 16,00 €
            1 PANECILLO RUSTICO      1,20 €  1,20 €
            1 TARTA PISTACHO         6,90 €  6,90 €
            1 COULANT CHOCOLATE      6,60 €  6,60 €
            
            Total: 54,60 €
            
            Base imponible  49,64
            I.V.A. 10,00%    4,96
            
            Forma de pago: Tarjeta
        """.trimIndent()

        val result = InvoiceParser.parse(text)

        println("\n=== La Mafia ===")
        println("Establecimiento: ${result.establishment}")
        println("Fecha: ${result.date}")
        println("Total: ${result.total}")
        println("Subtotal: ${result.subtotal}")
        println("IVA: ${result.tax}")
        println("Tasa IVA: ${result.taxRate?.times(100)}%")
        println("Confianza: ${result.confidence}")

        assertNotNull("Establecimiento no detectado", result.establishment)
        assertNotNull("Fecha no detectada", result.date)
        assertEquals("Total incorrecto", 54.60, result.total ?: 0.0, 0.01)
        assertEquals("Subtotal incorrecto", 49.64, result.subtotal ?: 0.0, 0.01)
        assertEquals("IVA incorrecto", 4.96, result.tax ?: 0.0, 0.01)
    }

    @Test
    fun testKimsBapReceipt() {
        // Texto simulado de la factura Kim's Bap
        val text = """
            KIM'S BAP
            
            C/ Lumbreras 38        TEL. 955501789
            SEVILLA                SEVILLA
            C.I.F. Y5313735J
            
            FACTURA Nº
            34/F/001               VENDEDOR 1
            FECHA31/01/2025        HORA 22:28:21
                                   MESA  11
            CLIENTE:
            FEDERICO ONDARTS
            DIRECCION
            CALLE PERAL 51 2A
            41002 SEVILLA          SEVILLA
            CIF: Z0641643V
            
            UNID.  DESCRIPCION  PRECIO  IMPORTE
            1      AGUA         1,82    1,82
            1      CRUZCAMPO    2,73    2,73
            1      J(T)        11,36   11,36
            1      R(B) No pic 10,91   10,91
            1      Salsa Pic    0,91    0,91
            1      HOTOK        5,00    5,00
            
            %   IMPORTE IVA  B.IMPONIBLE
            10,00   3,27        32,73
            
            FORMA DE PAGO: TARJETA
            
            TOTAL A PAGAR:  36,00
            
            GRACIAS POR SU VISITA
        """.trimIndent()

        val result = InvoiceParser.parse(text)

        println("\n=== Kim's Bap ===")
        println("Establecimiento: ${result.establishment}")
        println("Fecha: ${result.date}")
        println("Total: ${result.total}")
        println("Subtotal: ${result.subtotal}")
        println("IVA: ${result.tax}")
        println("Tasa IVA: ${result.taxRate?.times(100)}%")
        println("Confianza: ${result.confidence}")

        assertNotNull("Establecimiento no detectado", result.establishment)
        assertNotNull("Fecha no detectada", result.date)
        assertEquals("Total incorrecto", 36.00, result.total ?: 0.0, 0.01)
        assertEquals("Subtotal incorrecto", 32.73, result.subtotal ?: 0.0, 0.01)
        assertEquals("IVA incorrecto", 3.27, result.tax ?: 0.0, 0.01)
    }

    @Test
    fun testInformaticaPavonInvoice() {
        // Texto simulado de la factura formal PDF
        val text = """
            informatica pavon
            SERVICIOS INFORMATICOS PAVON SL
            Carretera Tocina, 34
            41520 El Viso del Alcor
            España
            
            Dirección de Entrega:
            Federico Ondarts
            Calle Peral 51
            41002 Sevilla
            
            Factura ES/2024/37466
            
            Fecha de factura: 24/06/2024
            Fecha de vencimiento: 24/06/2024
            
            Descripción          Cantidad   Importe
            Gastos de envío      1.000      0.00 €
            Batidora Xiaomi      1.000     59.88 €
            
            Subtotal                       59.88 €
            IVA 21%                        12.57 €
            Total                          72.45 €
        """.trimIndent()

        val result = InvoiceParser.parse(text)

        println("\n=== Informática Pavón ===")
        println("Establecimiento: ${result.establishment}")
        println("Fecha: ${result.date}")
        println("Total: ${result.total}")
        println("Subtotal: ${result.subtotal}")
        println("IVA: ${result.tax}")
        println("Tasa IVA: ${result.taxRate?.times(100)}%")
        println("Confianza: ${result.confidence}")

        assertNotNull("Establecimiento no detectado", result.establishment)
        assertNotNull("Fecha no detectada", result.date)
        assertEquals("Total incorrecto", 72.45, result.total ?: 0.0, 0.01)
        assertEquals("Subtotal incorrecto", 59.88, result.subtotal ?: 0.0, 0.01)
        assertEquals("IVA incorrecto", 12.57, result.tax ?: 0.0, 0.01)
    }

    @Test
    fun testMathematicalValidation() {
        // Test: solo tenemos Total y Subtotal, debe calcular IVA
        val text = """
            RESTAURANTE TEST
            Fecha: 15/01/2025
            Subtotal: 100,00 €
            Total: 110,00 €
        """.trimIndent()

        val result = InvoiceParser.parse(text)

        println("\n=== Test Cálculo Automático IVA ===")
        println("Total: ${result.total}")
        println("Subtotal: ${result.subtotal}")
        println("IVA calculado: ${result.tax}")

        assertEquals("Total incorrecto", 110.00, result.total ?: 0.0, 0.01)
        assertEquals("Subtotal incorrecto", 100.00, result.subtotal ?: 0.0, 0.01)
        assertEquals("IVA no calculado correctamente", 10.00, result.tax ?: 0.0, 0.01)
    }

    @Test
    fun testMathematicalValidation2() {
        // Test: solo tenemos Total e IVA, debe calcular Subtotal
        val text = """
            TIENDA EJEMPLO S.L.
            01/02/2025
            IVA 21%: 21,00 €
            Total: 121,00 €
        """.trimIndent()

        val result = InvoiceParser.parse(text)

        println("\n=== Test Cálculo Automático Subtotal ===")
        println("Total: ${result.total}")
        println("Subtotal calculado: ${result.subtotal}")
        println("IVA: ${result.tax}")

        assertEquals("Total incorrecto", 121.00, result.total ?: 0.0, 0.01)
        assertEquals("Subtotal no calculado correctamente", 100.00, result.subtotal ?: 0.0, 0.01)
        assertEquals("IVA incorrecto", 21.00, result.tax ?: 0.0, 0.01)
    }

    @Test
    fun testOuigoPdfDirectText() {
        // Texto extraído directamente del PDF de OUIGO (no OCR)
        val text = """
OUIGO ESPAÑA, S.A.U
Calle Alfonso XII, 62 4ª Planta
28014 Madrid
CIF/NIF: A88269972
www.ouigo.com/ES
Federico Ondarts
Calle Peral, 51
41002 Sevilla España
NIF/CIF Z0641643V
Nº factura LN202500032513
Fecha emisión documento 12/04/2025
Factura de canje en sustitución de la factura simplificada número L202500658896
Descripción Cantidad Precio de venta Descuento IVA Importe
Localizador GNYNM2
Viaje de ida - tren 06586 - Madrid - Puerta de Atocha - Almudena Grandes - Sevilla - Santa Justa del 13/04/2025
OUIGO Esencial 1 44.55 10% 44.55
Base imponible EUR 44.55
Importe IVA 4.45
Total factura EUR 49.00
Especificación importe IVA
Identific. IVA % Base IVA Importe IVA Total EUR
IVA 10 10% 44.55 4.45 49.00
Descuentos aplicados
Metodos de pago Fecha Importe EUR
Tarjeta bancaria 12/04/2025 13:15 49.00
        """.trimIndent()

        val result = InvoiceParser.parse(text)

        println("\n=== OUIGO PDF Direct Text ===")
        println("Establecimiento: ${result.establishment}")
        println("Fecha: ${result.date}")
        println("Total: ${result.total}")
        println("Subtotal: ${result.subtotal}")
        println("IVA: ${result.tax}")
        println("Tasa IVA: ${result.taxRate?.times(100)}%")
        println("Confianza: ${result.confidence}")

        assertNotNull("Establecimiento no detectado", result.establishment)
        assertNotNull("Fecha no detectada", result.date)
        
        // Valores esperados:
        // Total: 49.00
        // Base imponible (Subtotal): 44.55
        // IVA: 4.45
        // Tasa: 10%
        assertEquals("Total incorrecto", 49.00, result.total ?: 0.0, 0.01)
        assertEquals("Subtotal incorrecto", 44.55, result.subtotal ?: 0.0, 0.01)
        assertEquals("IVA incorrecto", 4.45, result.tax ?: 0.0, 0.01)
    }

    @Test
    fun testPiottaPdfOCR() {
        // Texto extraído de PDF donde las etiquetas están separadas de los valores
        val text = """
PIOTTA
Empresa
PIOTTA ROMANA
B44922904Factura19722.pdf
Calle de Ponzano, 93
Madrid 28003
Cliente
Federico Ondarts
Z0641643V
Calle de Melchor Fernández Almagro 10
Madrid 28029
Suma:
Descuento:
Subtotal:
Impuesto:
Total:
87,50 €
0.00 €
79,55 €
7,95 €
87,50 €
        """.trimIndent()

        val result = InvoiceParser.parse(text)

        println("\n=== Piotta PDF OCR ===")
        println("Establecimiento: ${result.establishment}")
        println("Total: ${result.total}")
        println("Subtotal: ${result.subtotal}")
        println("IVA: ${result.tax}")
        println("Tasa IVA: ${result.taxRate?.times(100)}%")
        println("Confianza: ${result.confidence}")

        assertNotNull("Establecimiento no detectado", result.establishment)
        
        // Valores esperados:
        // Total: 87,50
        // Subtotal: 79,55
        // IVA (Impuesto): 7,95
        // Tasa: 10%
        assertEquals("Total incorrecto", 87.50, result.total ?: 0.0, 0.01)
        assertEquals("Subtotal incorrecto", 79.55, result.subtotal ?: 0.0, 0.01)
        assertEquals("IVA incorrecto", 7.95, result.tax ?: 0.0, 0.01)
    }

    @Test
    fun testSibuyaRealOCR() {
        // Texto REAL extraído por OCR de la factura Sibuya
        // Formato especial: "BASE IMP IVA CUOTA" seguido de "108,00 10% 10,80"
        val text = """
FACTURA
SIBUYA MADRID 201
FO01/236
SIBUYA
C/ SANTO TOME, 5, 28004 MDRID
28046 Madrid
4
URDANS USHBAK
CIF: B88036850
UDS DESCRIPCION
NIF:z0641643v NOMBRE:Federico ondarts
DIRECCION:calle melchor fernandez almagro
CP: 28029 POBLACION: madrid
SERVICIO DE MESA
1 SPRITE
2 ASAHI SUPER DRY
3 AGUA CABREIROA
BAO
2 VEGAN
1 FREESTYLE 52S
1 CLASSIC ROLL
1 SALMON AVOCADO
BASE IMP IVA CUOTA
108,00 10% 10,80
Madrid
VISA
FECHA 11/10/2025
SALA 1 MESA 122
PVP
3,50
2,50
3,10
5,90
65,90
13,90
9,60
ENTREGAD0
IMPORTE
118,80
7,00 €
7,50 €
3,10 €
11,80 €
65,90 €
13,90 €
TOTAL 18,80 €
9,60 €
CAMBIO
0,00 €
*** GRACIAS POR SU VISITA ***
AlENDIDO POR: FLavia Vanesa Velasquez
        """.trimIndent()

        val result = InvoiceParser.parse(text)

        println("\n=== Sibuya Real OCR ===")
        println("Establecimiento: ${result.establishment}")
        println("Fecha: ${result.date}")
        println("Total: ${result.total}")
        println("Subtotal: ${result.subtotal}")
        println("IVA: ${result.tax}")
        println("Tasa IVA: ${result.taxRate?.times(100)}%")
        println("Confianza: ${result.confidence}")

        assertNotNull("Establecimiento no detectado", result.establishment)
        assertNotNull("Fecha no detectada", result.date)
        
        // Valores esperados de la factura real:
        // Total: 118,80
        // Base Imponible (Subtotal): 108,00
        // IVA: 10,80
        // Tasa: 10%
        assertEquals("Total incorrecto", 118.80, result.total ?: 0.0, 0.01)
        assertEquals("Subtotal incorrecto", 108.00, result.subtotal ?: 0.0, 0.01)
        assertEquals("IVA incorrecto", 10.80, result.tax ?: 0.0, 0.01)
        assertEquals("Tasa IVA incorrecta", 0.10, result.taxRate ?: 0.0, 0.01)
    }

    @Test
    fun testKimsBapRealOCR() {
        // Texto REAL extraído por OCR de la factura Kim's Bap (proporcionado por usuario)
        // Este es el caso donde las etiquetas y valores están en líneas separadas
        val text = """
KIM'S BAP (DAEIL KIM)
C/ Lumbreras 38
SEVILLA
C.l.F. Y5313735J
FACTURA NO
52/F/ 001
FECHA13/04/2025
CLIENTE:
FEDERICO ONDARTS
DIRECOION:
CALLE PERAL, 51
41002 SEVILLA
CIF: Z0641643V
1
2 AGUA
1 TF (P)
K(${"$"}S)
UNID. DESCRIPCION PRECIO
1 R(B) No plcante
TEL. 955510789
SEVILLA
10,00
VENDEDOR
3,14
HORA 21:59:39
MESA
SEVILLA
FORMA DE PAGO:TARJETA
1,82
CAMBIO:
6,36
10,45
10,91
% IMPORTE IVA B.IMPONIBLE
ENTREGADO:
LE ATENDIO Aracelis / Yoorim
TOTAL A PAGAR:
GRACIAS POR SUVISITA
1
IMPORTE
3,64
10,45
31,36
6,36
10,91
34,50
0,00
34,50
        """.trimIndent()

        val result = InvoiceParser.parse(text)

        println("\n=== Kim's Bap Real OCR ===")
        println("Establecimiento: ${result.establishment}")
        println("Fecha: ${result.date}")
        println("Total: ${result.total}")
        println("Subtotal: ${result.subtotal}")
        println("IVA: ${result.tax}")
        println("Tasa IVA: ${result.taxRate?.times(100)}%")
        println("Confianza: ${result.confidence}")

        assertNotNull("Establecimiento no detectado", result.establishment)
        assertEquals("Establecimiento incorrecto", "KIM'S BAP (DAEIL KIM)", result.establishment)
        assertNotNull("Fecha no detectada", result.date)
        
        // Valores esperados de la factura real:
        // Total: 34,50
        // Base Imponible (Subtotal): 31,36
        // IVA: 3,14
        // Tasa: 10%
        assertEquals("Total incorrecto", 34.50, result.total ?: 0.0, 0.01)
        assertEquals("Subtotal incorrecto", 31.36, result.subtotal ?: 0.0, 0.01)
        assertEquals("IVA incorrecto", 3.14, result.tax ?: 0.0, 0.01)
        assertEquals("Tasa IVA incorrecta", 0.10, result.taxRate ?: 0.0, 0.01)
    }
}

