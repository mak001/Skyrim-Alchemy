const defaults = [
	{name: "updateIngredients", value: "true"}
];
const passive = supportsPassive();

$( document ).bind( "mobileinit", function() {
	$.support.cors = true;
    $.mobile.allowCrossDomainPages = true;
});

$(document).ready(function() {
	// removes the hash from the url
	history.pushState("", document.title, window.location.pathname + window.location.search);
	
	$.mobile.loading( 'show', {
		text: "Loading...",
		textVisible: true,
		theme: "b",
		textonly: false
	});
	
	// makes the passive - should (doesn't seem to)
	document.addEventListener('touchstart', function() {}, passive ? { passive: true, capture: false } : false);
	document.addEventListener('touchmove', function() {}, passive ? { passive: true, capture: false } : false);
	
	// from http://stackoverflow.com/a/26163475  (modified a little bit)
	$(document).on('popupafteropen', '.ui-popup' ,function( event, ui ) {
		$('body').css('overflow','hidden');
	}).on('popupafterclose', '.ui-popup' ,function( event, ui ) {
		$('body').css('overflow','auto');
	});
	
	$('#add-ingredient-comment').enhanceWithin().popup();
	$('#edit-ingredient-comment').enhanceWithin().popup();
	$('#delete-ingredient-comment').enhanceWithin().popup();
	
	// general popup cancel 
	$('.cancel').click(function() {
		$('.ui-popup').popup('close');
		return false; // same as event.preventDefualt();
	});
	
	/*	Add ingredient events	*/
	$('#add-ingredient-comment').on('click', '.submit', function() {
		addComment();
		return false; // same as event.preventDefualt();
	});
	
	$('body').on('click', '.add-ingredient-comment', function() {
		$('#addIngredientCommentID').val($(this).parents('.page').attr('id'));
		$('#add-ingredient-comment').popup('open');
	});
	
	/*	Edit ingredient events	*/
	$('#edit-ingredient-comment').on('click', '.submit', function() {
		var id = $('#editIngredientCommentID').val();
		var comment = $('#edit-ingredient-comment').find('textarea').val();
		updateComment(id, comment, function() {
			$('#editIngredientCommentID').val('');
			$('#edit-ingredient-comment').find('textarea').val('');
			$('#edit-ingredient-comment').popup('close');
		});
		return false; // same as event.preventDefualt();
	});
	
	$('#edit-ingredient-comment').on('click', '.reset', function() {
		var id = $('#editIngredientCommentID').val();
		getComment(id, function(result) {
			$('#edit-ingredient-comment').find('textarea').val(result.comment);
		});
		return false;
	});
	
	$('body').on('click', '.edit-ingredient-comment', function() {
		var id = $(this).parents('.comment').attr('id').replace('comment-', '');
		$('#editIngredientCommentID').val(id);
		getComment(id, function(result) {
			$('#edit-ingredient-comment').find('textarea').val(result.comment);
		});
		$('#edit-ingredient-comment').popup('open');
	});
	
	/*	Delete ingredient events	*/
	$('body').on('click', '.delete-ingredient-comment', function() {
		var id = $(this).parents('.comment').attr('id').replace('comment-', '');
		var comment = $(this).parents('.comment').find('.text-display').text();
		
		$('#deleteIngredientCommentID').val(id);
		$('#delete-comment-content').text(comment);
		
		$('#delete-ingredient-comment').popup('open');
	});
	
	$('#delete-ingredient-comment').on('click', '.delete', function() {
		var id = $('#deleteIngredientCommentID').val();
		deleteComment(id, function() {
			$('#deleteIngredientCommentID').val('');
			$('#delete-ingredient-comment').find('.text-display').val('');
			$('#delete-ingredient-comment').popup('close');
		});
	});
	
});

var db;

$(window).load(function() {
	
	if (!"indexedDB" in window) {
		return;
	}
	
	var openRequest = indexedDB.open("Skyrim", 5);
	
	openRequest.onupgradeneeded = function(e) {
		var thisDB = e.target.result;
		
		if (!thisDB.objectStoreNames.contains("settings")) {
			var objectStore = thisDB.createObjectStore("settings", {keyPath: 'name', unique: true});
			objectStore.createIndex("value", "value", {unique: false});
			
			for (var d in defaults) {
				objectStore.add(defaults[d]);
			}
		}
		
		if (!thisDB.objectStoreNames.contains("ingredients")) {
			var objectStore = thisDB.createObjectStore("ingredients", {keyPath: 'name', unique: true});
			objectStore.createIndex("effects", "effects", {unique: false, multiEntry: true});
			objectStore.createIndex("weight", "weight", {unique: false});
			objectStore.createIndex("value", "value", {unique: false});
		}
		
		if (!thisDB.objectStoreNames.contains("ingredientComments")) {
			var objectStore = thisDB.createObjectStore("ingredientComments", {keyPath: 'id', autoIncrement: true});
			objectStore.createIndex("ingredientID", "ingredientID", {unique: false});
			objectStore.createIndex("comment", "comment", {unique: false});
		}
		
		//if (!thisDB.objectStoreNames.contains("effects")) {
		//	var objectStore = thisDB.createObjectStore("effects", {keyPath: 'id', autoIncrement: true});
		//	objectStore.createIndex("name", "name", {unique: false});
			// TODO - ??
		//}
	};
	
	openRequest.onsuccess = function(e) {
		db = e.target.result;
		console.log("everything is OK");
		
		// updates if the store hasn't been popultaed
		getSetting("updateIngredients", updateIngredients);
	};
	
	openRequest.onerror = function(e) {
		console.log("something went wrong");
	};
	
});

// Form Modernizr
function supportsPassive() {
	var supportsPassiveOption = false;
	try {
		var opts = Object.defineProperty({}, 'passive', {
			get: function() {
				supportsPassiveOption = true;
			}
		});
		window.addEventListener('test', null, opts);
	} catch (e) {}
	return supportsPassiveOption;
}

function updateIngredients(obj) {
	var should = (obj === undefined) ? false : obj.value;
	if (should == false || should == "false") {
		console.log("skipping update");
		generateIngredients();
		return;
	}
	console.log("updating");
	$.ajax({
		crossOrigin: true,
		crossDomain: true,
		url: "http://elderscrolls.wikia.com/api.php?format=xml&action=parse&page=Ingredients_(Skyrim)",
		dataType: "xml",
		// so it errors out if file type isn't right
		timeout: 10000,
		success: function(data) {
			var newData = $($.parseHTML($(data).find('text').text())).not(':not(#ingredientsTable)').filter('*');

			$('#data-dump').append(newData);
			var table = $('#ingredientsTable')
			var rows = table.find('tr:not(:first)');
			
			var data = [];
			
			for (var i = 0; i < rows.length; i++) {
				var row = rows.eq(i).find('td');
				var ingredient = {
					name: getCellText(row, 0),
					effects: {
						"0": getCellText(row, 1),
						"1": getCellText(row, 2),
						"2": getCellText(row, 3),
						"3": getCellText(row, 4)
					},
					weight: getCellText(row, 5),
					value: getCellText(row, 6)
				};
				
				data[data.length] = ingredient;
			}
			
			populate(getIngredientStore("readwrite"), data, function() {
				updateSetting("updateIngredients", "false");
				table.remove();
				generateIngredients();
			});
		},
		
		error: function() {
			console.log('error loading');
			$('.ui-icon-loading').css({
				background: 'none'
			});
			$('.ui-loader h1').text('Error loading');
			navigator.splashscreen.hide();
		}
	});
}

function getCellText(row, cell) {
	return row.eq(cell).text().trim().replace(/[\*|‡|†]$/, "");
}

/*
* Gets the tasks store
* defualts to read only access
*/
function getSettingStore(access) {
	if (access === undefined) {
		access = "readonly";
    }
	return db.transaction("settings", access).objectStore("settings");
}

function getIngredientStore(access) {
	if (access === undefined) {
		access = "readonly";
    }
	return db.transaction("ingredients", access).objectStore("ingredients");
}

function getIngredientCommentStore(access) {
	if (access === undefined) {
		access = "readonly";
    }
	return db.transaction("ingredientComments", access).objectStore("ingredientComments");
}

//function getEffectStore(access = "readonly") {
//	return db.transaction("effects", access).objectStore("effects");
//}

function getSetting(name, callback) {
	var store = getSettingStore();
	var request = store.get(name);
	
	request.onsuccess = function() {
		if (typeof callback === "function") {
			callback(request.result);
		}
	}
}

function updateSetting(name, value, callback) {
	var store = getSettingStore("readwrite");
	var request = store.put({name: name, value: value});
	
	request.onsuccess = function() {
		if (typeof callback === "function") {
			callback();
		}
	}
}

function populate(store, items, callback) {
	
	var i = 0;
	function putNext() {
		if (i < items.length) {
			//console.log("Adding " + (i + 1) + " / " + items.length);
		
			request = store.put(items[i]);
			
			request.onsuccess = function() {
				i++;
				putNext();
			};
			
			request.onerror = function() {
				console.log("failed to put in next : " + i);
			};

		} else {
			console.log("Finished adding items");
			if (typeof callback === "function") {
				callback();
			}
		}
	}
	
	// starts the recursion
	putNext();
}

function generateIngredients() {
	store = getIngredientStore();
	var request = store.openCursor();
	
	request.onsuccess = function(e) {
		var cursor = e.target.result;
		
		if (cursor != null) {
			var values = cursor.value;
			var id = values.name.toLowerCase().replace(/\s/g, '-').replace(/[',\(,\)]/g, "");
			$('#ingredient-list .list').append('<li><a href="#' + id + '" data-transition="slide">' + values.name + '</a></li>');
			
			var html = '';
			html += '<div id="' + id + '" data-role="page" class="page">';
			html += 	'<div data-role="header" data-position="fixed">';
			html += 		'<h1>' + values.name + '</h1>';
			html += 		'<a class="ui-btn" data-rel="back" href="#" data-transition="slide" data-direction="reverse">Back</a>';
			html +=			'<a class="ui-btn ui-btn-icon-left ui-icon-plus add-ingredient-comment" data-rel="popup" data-role="button">Note</a>';
			html += 	'</div>';
			html += 	'<div data-role="main" class="ui-content">';
			html +=			'<div class="img-container">';
			html +=				'<img src="images/' + id + '.png" class="ui-shadow ui-corner-all"/>';
			html +=			'</div>';
			html +=			'<ul data-role="listview" data-inset="true">';
			html +=				'<li data-role="list-divider"><h3>Effects</h3></li>';
			html +=				'<li>' + values.effects[0] + '</li>';
			html +=				'<li>' + values.effects[1] + '</li>';
			html +=				'<li>' + values.effects[2] + '</li>';
			html +=				'<li>' + values.effects[3] + '</li>';
			html +=			'</ul>';
			html +=			'<table data-role="table" class="ui-shadow ui-corner-all item-data">';
			html +=				'<thead>';
			html +=					'<tr></tr>';
			html +=				'</thead>';
			html +=				'<tbody>';
			html +=					'<tr>';
			html +=						'<th>Weight</th>';
			html +=						'<td>' + values.weight + '</td>';
			html +=					'</tr>';
			html +=					'<tr>';
			html +=						'<th>Value</th>';
			html +=						'<td>' + values.value + '</td>';
			html +=					'</tr>';
			html +=				'</tbody>';
			html +=			'</table>';
			html +=			'<ul data-role="list-view" data-inset="true" class="comments">';
			html +=			'</ul>';
			html += 	'</div>';
			html += '</div>';
			
			$(html).insertBefore('#data-dump');
			getComments(id);
			
			cursor.continue();
		} else {
			$('.task').enhanceWithin();
			// initializes it so it doesn't error out when trying to refresh
			$('#ingredient-list .list').listview().listview('refresh');
			$.mobile.loading("hide");
			navigator.splashscreen.hide();
		}
	}
	
	request.onerror = function() {
		console.log("Error when trying to retrieve");
	}
}

function getComments(id, callback) {
	var store = getIngredientCommentStore();
	var index = store.index('ingredientID');
	var singleKeyRange = IDBKeyRange.only(id);
	
	$('#' + id).find('.comments').html('');
	
	var request = index.openCursor(singleKeyRange);
	
	request.onsuccess = function(e) {
		var cursor = e.target.result;
		if (cursor != null) {
			var key = cursor.key;
			var values = cursor.value;
			
			var comment = '<li id=comment-' + values.id + ' class="comment">';
			comment +=		'<div class="text-display">' + values.comment + '</div>';
			comment +=		'<p data-role="controlgroup" data-type="horizontal" data-mini="true">';
			comment +=			'<a class="ui-btn edit-ingredient-comment">Edit</a>';
			comment +=			'<a class="ui-btn delete-ingredient-comment">Delete</a>';
			comment +=		'</p>';
			comment +=	  '</li>';
			$('#' + id + ' .comments').append(comment);
			
			cursor.continue();
		} else {
			$('#' + id + ' .comment').enhanceWithin();
			$('#' + id + ' .comments').listview().listview("refresh");
			
			if (typeof callback == 'function') {
				callback();
			}
		}
	};
}

function addComment() {
	var form = $('#add-ingredient-comment');
	var ingredientID = form.find('#addIngredientCommentID');
	var comment = form.find('textarea');
	
	var store = getIngredientCommentStore("readwrite");
	
	var request = store.put({
		ingredientID: ingredientID.val(),
		comment: comment.val()
	});
	
	request.onsuccess = function() {
		console.log("successfully added comment");
		getComments(ingredientID.val(), function() {
			ingredientID.val('');
			comment.val('');
			$('#add-ingredient-comment').popup('close');
		});
		
	}
}

function getComment(id, callback) {
	var store = getIngredientCommentStore();
	var request = store.get(Number(id));
	
	request.onsuccess = function(e) {
		if (typeof callback == "function") {
			callback(e.target.result);
		}
	};
}

function updateComment(id, comment, callback) {
	id = Number(id);
	if (isNaN(id)) {
		return;
	}
	var ingredientID = $('.ui-page-active').attr('id');
	var store = getIngredientCommentStore("readwrite");
	var request = store.put({
		id: Number(id),
		comment: comment,
		ingredientID: ingredientID
	});
	
	request.onsuccess = function() {
		getComments(ingredientID, callback);
	}
}

function deleteComment(id, callback) {
	id = Number(id);
	if (isNaN(id)) {
		return;
	}
	
	var ingredientID = $('.ui-page-active').attr('id');
	
	var store = getIngredientCommentStore("readwrite");
	var request = store.delete(id);
	
	request.onsuccess = function() {
		getComments(ingredientID, callback);
	}
}
