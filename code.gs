var scriptSet = PropertiesService.getScriptProperties();

//HUBUNGKAN DENGAN TELEGRAM DAN GOOGLE SHEET
var token = '*****'; // Isi dengan token bot Telegram
var sheetID = '*****'; // Isi dengan SheetID Google Sheet
var sheetName = '***'; // Isi dengan nama Sheet
var webAppURL = '******'; // Isi dengan Web URL Google Script setelah deploy

//SETTING DATA APA SAJA YANG AKAN DIINPUT
var dataInput = /\/SSID: (.*)\n\nNAMA: (.*)/gmi;
var validasiData = /:\s{0,1}(.*)/ig;

//PESAN JIKA FORMAT DATA YANG DIKIRIM SALAH
var errorMessage = "Format Salah!";

function tulis(dataInput) {
  var sheet1 = SpreadsheetApp.openById(sheetID).getSheetByName(sheetName);
  sheet1.appendRow(dataInput);
}

function breakData(update) {
  var ret = errorMessage;
  var msg = update.message;
  var str = msg.text;
  var match = str.match(validasiData);

  //SETTING FORMAT DATA YANG AKAN DIINPUT
  if (match && match.length === 2) {
    for (var i = 0; i < match.length; i++) {
      match[i] = match[i].replace(':', '').trim();
    }
    ret = "SSID" + match[0] + "\n\n";
    ret += "NAMA" + match[1] + "\n\n";
    ret = `Data (${match[0]}) Berhasil Tersimpan, Terima kasih!`;

    var simpan = match;

    var sheet = SpreadsheetApp.openById(sheetID).getSheetByName(sheetName);
    var lastRow = sheet.getLastRow() -1 + 1; // Memberikan nomor urut diawal penginputan
    match.unshift(lastRow);

    tulis(simpan);
  }
  return ret;
}

function escapeHtml(text) {
  var map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, function(m) {
    return map[m];
  });
}

function doGet(e) {
  return HtmlService.createHtmlOutput("Hey there! send POST request instead!");
}

function doPost(e) {
  if (e.postData.type === "application/json") {
    var update = JSON.parse(e.postData.contents);
    var bot = new Bot(token, update);
    var bus = new CommandBus();
    
    bus.on(/\/help/i, function() {
      this.replyToSender("<b>/format -> Menampilkan Format</b>\n <b>/cari -> Mencari Data (/cari 222->SSID)");
    });

    bus.on(/\/test/i, function() {
      this.replyToSender("<b>Aman Maseh</b>");
    });

    bus.on(/\/format/i, function() {
      this.replyToSender("<b>/SSID:</b>\n<b>NAMA:</b>");
    });

    // Menambahkan command /cari untuk mencari SSID
    bus.on(/\/cari (\S+)/i, function(ssid) { // Memproses command /cari diikuti SSID
      cari(update);
    });

    bus.on(validasiData, function() {
      var rtext = breakData(update);
      this.replyToSender(rtext);
    });

    bot.register(bus);

    if (update) {
      bot.proses();
    }
  }
}

function setWebHook() {
  var bot = new Bot(token, {});
  var result = bot.request('setWebHook', {
    url: webAppURL
  });
  Logger.log(ScriptApp.getService().getUrl());
  Logger.log(result);
}

function Bot(token, update) {
  this.token = token;
  this.update = update;
  this.handlers = [];
}

Bot.prototype.register = function(handler) {
  this.handlers.push(handler);
}

Bot.prototype.proses = function() {
  for (var i in this.handlers) {
    var event = this.handlers[i];
    var result = event.condition(this);
    if (result) {
      return event.handle(this);
    }
  }
}

Bot.prototype.request = function(method, data) {
  var options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(data)
  };

  var response = UrlFetchApp.fetch('https://api.telegram.org/bot' + this.token + '/' + method, options);

  if (response.getResponseCode() === 100) {
    return JSON.parse(response.getContentText());
  }
  return false;
}

Bot.prototype.replyToSender = function(text) {
  return this.request('sendMessage', {
    'chat_id': this.update.message.chat.id,
    'parse_mode': 'HTML',
    'text': text,
    'reply_to_message_id': this.update.message.message_id // Menambahkan reply ke pesan asli
  });
};


function CommandBus() {
  this.command = [];
}

CommandBus.prototype.on = function(regexp, callback) {
  this.command.push({ 'regexp': regexp, 'callback': callback });
}

CommandBus.prototype.condition = function(bot) {
  return bot.update.message.text.charAt(0) === '/';
}

CommandBus.prototype.handle = function(bot) {
  for (var i in this.command) {
    var cmd = this.command[i];
    var tokens = cmd.regexp.exec(bot.update.message.text);
    if (tokens != null) {
      return cmd.callback.apply(bot, tokens.slice(1));
    }
  }
  return bot.replyToSender(errorMessage);
}

function cari(update) {
  var msg = update.message;
  var text = msg.text;
  var match = text.match(/\/cari (\S+)/); // Regex untuk mencari SSID yang diinput setelah perintah /cari

  if (match && match.length > 1) {
    var id = match[1]; // SSID yang dicari dari pesan
    if (isDataAvail(id)) {
      var dataGabungan = ambilData(id);
      var bot = new Bot(token, update); // Buat objek bot baru di sini
      bot.replyToSender(dataGabungan);
    } else {
      var bot = new Bot(token, update); // Buat objek bot baru di sini
      bot.replyToSender("SSID tidak ditemukan!");
    }
  } else {
    var bot = new Bot(token, update); // Buat objek bot baru di sini
    bot.replyToSender("Format Salah! Gunakan /cari <SSID>.");
  }
}

function ambilData(id) {
  var sheet = SpreadsheetApp.openById(sheetID).getSheetByName(sheetName);
  var dataRange = sheet.getRange("B2:C" + sheet.getLastRow()); // Ambil data dari kolom A dan C
  var rows = dataRange.getValues();
  var data = [];

  for (var row = 0; row < rows.length; row++) {
    if (rows[row][0] == id) {  // Kolom A dianggap menyimpan SSID
      var info = 
        'SSID: ' + rows[row][0] + '\n' +  // Kolom A: SSID
        'Nama: ' + rows[row][1] + '\n';   // Kolom B: Nama
      data.push(info);
    }
  }

  if (data.length === 0) {
    return "SSID tidak ditemukan!";
  }

  var dataGabungan = data.join('\n');
  return dataGabungan;
}

function isDataAvail(id) {
  var sheet = SpreadsheetApp.openById(sheetID).getSheetByName(sheetName);
  var dataRange = sheet.getRange("B2:B" + sheet.getLastRow()); // Ambil hanya kolom A (SSID)
  var rows = dataRange.getValues();

  for (var row = 0; row < rows.length; row++) {
    if (rows[row][0] == id) {  // Kolom A dianggap menyimpan SSID
      return true;
    }
  }
  return false;
}
