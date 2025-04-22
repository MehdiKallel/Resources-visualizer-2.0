function uidash_click_tab(moi) {
  $(moi).trigger('click');
}

function uidash_close_tab(moi){
  var active = $(moi).parent().attr('data-tab');
  var tabbed = $(moi).parent().parent().parent();
  var is_inactive = $(moi).parent().hasClass('inactive');
  $('*[data-tab=' + active + ']').remove();
  $('*[data-belongs-to-tab=' + active + ']').remove();
  if (!is_inactive)
    uidash_click_tab($('ui-tabbar ui-tab.default'));
}

function uidash_add_close(moi) {
  $(moi).append($('<ui-close>✖</ui-close>'));
}

function uidash_empty_tab_contents(id) {
  $('ui-content ui-area[data-belongs-to-tab=' + id + ']').empty();
}

function uidash_add_tab(tabbed,title,id,closeable,additionalclasses) {
  additionalclasses = (typeof additionalclasses !== 'undefined') ? additionalclasses : '';
  if ($('ui-tabbar ui-tab[data-tab=' + id + ']').length > 0) {
    uidash_activate_tab($('ui-tabbar ui-tab[data-tab=' + id + ']'));
    return false;
  } else {
    var instab = $(
      "<ui-tab class='inactive" +
        (closeable ? ' closeable' : '') +
        (additionalclasses === '' ? '' : ' ' + additionalclasses) +
      "' data-tab='" + id + "'>" + title + "</ui-tab>"
    );
    var insarea = $(
      "<ui-area data-belongs-to-tab='" + id + "' class='inactive'>" +
        "<div class='tab-content'></div>" +
      "</ui-area>"
    );
    $(tabbed).find('ui-behind').before(instab);
    $(tabbed).find('ui-content').append(insarea);
    uidash_add_close($('ui-tabbar ui-tab[data-tab=' + id + ']'));
    return true;
  }
}

function uidash_add_tab_active(tabbed,title,id,closeable,additionalclasses) {
  var state = uidash_add_tab(tabbed,title,id,closeable,additionalclasses);
  if (state) {
    uidash_activate_tab($('ui-tabbar ui-tab[data-tab=' + id + ']'));
  }
  return state;
}

function uidash_clone_tab(tabbar,original,title,id,closeable,additionalclasses) {
  additionalclasses = typeof additionalclasses !== 'undefined' ? additionalclasses : '';
  var instab = $(
    "<ui-tab class='inactive" +
      (closeable ? ' closeable' : '') +
      (additionalclasses === '' ? '' : ' ' + additionalclasses) +
    "' data-tab='" + id + "' id='tab_" + id + "'>" + title + "</ui-tab>"
  );
  var insarea = original.clone();
  insarea.attr("data-belongs-to-tab",id);
  insarea.attr("class","inactive");
  $(tabbar).find('ui-behind').before(instab);
  $(tabbar).parent().append(insarea);
  uidash_add_close($('ui-tabbed ui-tab[data-tab=' + id + ']'));
}

(function($) {
  $.fn.dragcolumn = function() {
    var drag = $(this);
    var prev = drag.prev();
    var next = drag.next();

    this.bind("mousedown", function(e) {
      drag.addClass('draggable');
      $('body').addClass('drag-in-progress');
      $(document).one("mouseup", function(e) {
        drag.removeClass('draggable');
        $('body').removeClass('drag-in-progress');
        e.preventDefault();
      });
      e.preventDefault();
    });

    $(document).bind("mousemove", function(e) {
      if (!drag.hasClass('draggable')) {
        return;
      }
      var total = prev.outerWidth() + next.outerWidth();
      var pos = e.pageX - prev.offset().left;
      if (pos > total) {
        pos = total;
      }
      var leftPercentage = pos / total;
      var rightPercentage = 1 - leftPercentage;
      prev.css('flex', leftPercentage.toString());
      next.css('flex', rightPercentage.toString());
      e.preventDefault();
    });
  };

  $.fn.dragresize = function() {
    var drag = $(this);
    var prev = drag.prev();
    var initpos = 0;
    var initheight = 0;

    this.bind("mousedown", function(e) {
      drag.addClass('draggable');
      initpos = e.pageY;
      initheight = $("ui-content", prev).height();
      $(document).one("mouseup", function(e) {
        drag.removeClass('draggable');
        e.preventDefault();
      });
      e.preventDefault();
    });

    $(document).bind("mousemove", function(e) {
      if (!drag.hasClass('draggable')) {
        return;
      }
      var pos = initheight - (initpos - e.pageY);
      if (pos < 0) {
        return;
      }
      $("ui-content", prev).css('height', pos.toString());
      e.preventDefault();
    });
  };
})(jQuery);

function uidash_activate_tab(moi) {
  var active = $(moi).attr('data-tab');
  var tabbed = $(moi).parent().parent();
  var tabs = [];
  $("ui-tabbar > ui-tab", tabbed).each(function() {
    if (!$(this).hasClass('switch')) {
      tabs.push($(this).attr('data-tab'));
    }
  });

  $("ui-tabbar > ui-tab.inactive", tabbed).removeClass("inactive");
  $("ui-content > *[data-belongs-to-tab].inactive", tabbed).removeClass("inactive");

  $("ui-content > *[data-belongs-to-tab] .tab-content", tabbed).removeClass("active");

  $.each(tabs, function(i, tabId) {
    if (tabId !== active) {
      $("ui-tabbar ui-tab[data-tab='" + tabId + "']", tabbed).addClass("inactive");
      $("ui-content *[data-belongs-to-tab='" + tabId + "']", tabbed)
        .addClass("inactive")
        .find(".tab-content")
        .removeClass("active");
    } else {
      $("ui-content *[data-belongs-to-tab='" + tabId + "']", tabbed)
        .find(".tab-content")
        .addClass("active");
    }
  });
}

function uidash_toggle_vis_tab(moi) {
  var tabbed = null;
  if ($(moi).length > 0 && $(moi)[0].nodeName === 'UI-TABBED') {
    tabbed = $(moi);
  }
  if ($(moi).length > 0 && $(moi)[0].nodeName === 'UI-TAB') {
    tabbed = $(moi).parent().parent();
  }
  if (tabbed) {
    tabbed.toggleClass('off');
  }
}

$(document).ready(function() {
  $('ui-rest ui-content ui-resizehandle').dragcolumn();
  $('*[is=x-ui-] > ui-resizehandle').dragresize();

  $(document).delegate('ui-tabbar ui-tab.switch', 'click', function() {
    uidash_toggle_vis_tab(this);
  });
  $(document).delegate('ui-tabbar ui-tab:not(.switch)', 'click', function() {
    uidash_activate_tab(this);
  });

  uidash_add_close($('ui-tabbar ui-tab.closeable', 'click'));

  $(document).delegate('ui-tabbar ui-tab.closeable ui-close', 'click', function() {
    uidash_close_tab(this);
  });
});
