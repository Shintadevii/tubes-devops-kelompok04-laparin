/**
 * Total pesanan SELALU dihitung di server dari harga yang tersimpan di database.
 * Field harga/total apa pun yang dikirim klien tidak dipakai.
 *
 * @param {Array<{unitPrice:number, quantity:number}>} lines  baris dari data DB + qty keranjang
 */
function validateQuantity(quantity) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    const error = new Error('Jumlah item harus bilangan bulat lebih dari 0');
    error.code = 'INVALID_QUANTITY';
    throw error;
  }
  return quantity;
}

function calculateOrderTotal(lines) {
  if (!Array.isArray(lines) || lines.length === 0) {
    const error = new Error('Keranjang kosong');
    error.code = 'EMPTY_CART';
    throw error;
  }

  return lines.reduce((total, line) => {
    validateQuantity(line.quantity);
    return total + line.unitPrice * line.quantity;
  }, 0);
}

module.exports = { validateQuantity, calculateOrderTotal };