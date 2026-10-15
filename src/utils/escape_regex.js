// Escape user input before using it inside a RegExp
module.exports = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');