function relationstoggle() {
    toggle($(".relation"), "inactive");
  }
  function subjectnumberstoggle() {
    toggle($(".subjecticon.number tspan"), "inactive");
  }
  function orbittoggle() {
    toggle($(".connect"), "inactive");
  }
  function changetspans(tspans, t1, t2) {
    $.each(tspans, function (a, d) {
      d.textContent = d.textContent == t1 ? t2 : t1;
    });
  }
  function toggle(things, cls) {
    $.each(things, function (a, d) {
      $(d).toggleClass(cls);
    });
  }
  function s_relationstoggle(nid) {
    relationstoggle();
    subjectnumberstoggle();
    orbittoggle();

    var togglers = [];
    var tspans = [];
    var units = [];
    var roles = [];
    $.each($(".relation." + $(nid).attr("id")), function (a, b) {
      $(b)
        .attr("class")
        .match(/(u\d+) (r\d+)/);
      u = RegExp.$1;
      r = RegExp.$2;
      togglers.push(b);
      togglers.push("#" + r + " .subjecticon");
      togglers.push("#" + u + " .subjecticon");
      togglers.push("#" + r + " .role");
      togglers.push("#" + u + " .unit");
      tspans.push($("#" + r + " .subjecticon.number tspan.special")[0]);
      tspans.push($("#" + u + " .subjecticon.number tspan.special")[0]);
      units.push(u);
      roles.push(r);
    });
    togglers = _.uniq(togglers);
    tspans = _.uniq(tspans);
    units = _.uniq(units);
    roles = _.uniq(roles);
    $.each(units, function (a, b) {
      $.each(units, function (c, d) {
        $(".connect.f" + b + ".t" + d).toggleClass("highlight");
      });
    });
    $.each(roles, function (a, b) {
      $.each(roles, function (c, d) {
        $(".connect.f" + b + ".t" + d).toggleClass("highlight");
      });
    });
    changetspans(tspans, "1", "");
    toggle(togglers, "highlight");
    toggle($(nid).find(".subjecticon"), "highlight");
  }

  function ur_filtertoggle(nid) {
    var subjects = [];
    $.each($(".relation." + $(nid).attr("id")), function (a, b) {
      var res = $(b)
        .attr("class")
        .match(/(s\d+ )*(s\d+)/);
      res = res[0].split(" ");
      subjects = _.union(subjects, res);
    });
    subjects = _.uniq(subjects);
    subjects = _.map(subjects, function (d) {
      return "#" + d;
    });
    $.each($(".subject"), function (a, d) {
      $(d).removeClass("hidden");
    });
    $.each($(".activefilter"), function (a, d) {
      $(d).removeClass("activefilter");
    });
    if (filter == $(nid).attr("id")) {
      filter = "";
    } else {
      filter = $(nid).attr("id");
      $("#" + filter + "_text").addClass("activefilter");
      var allsubjects = _.map($(".subject"), function (d) {
        return "#" + $(d).attr("id");
      });
      $.each(_.difference(allsubjects, subjects), function (a, d) {
        $(d).addClass("hidden");
      });
    }
  }

  function ur_relationstoggle(nid) {
    relationstoggle();
    subjectnumberstoggle();
    orbittoggle();

    var subjects = [];
    $.each($(".relation." + $(nid).attr("id")), function (a, b) {
      $(b).toggleClass($(nid).attr("class"));
      var res = $(b)
        .attr("class")
        .match(/(s\d+ )*(s\d+)/);
      res = res[0].split(" ");
      var len = res.length;
      subjects = _.union(subjects, res);
      if ($(nid).hasClass("role")) {
        var target = $(b)
          .attr("class")
          .match(/(u\d+)/)[1];
      } else {
        var target = $(b)
          .attr("class")
          .match(/(r\d+)/)[1];
      }
      changetspans(
        $("#" + target + " .subjecticon.number tspan.special"),
        len,
        ""
      );
    });
    subjects = _.uniq(subjects);
    subjects = _.map(subjects, function (d) {
      return "#" + d;
    });
    toggle(
      subjects,
      $(nid).hasClass("role") ? "highlightrole" : "highlightunit"
    );
    changetspans(
      $("#" + $(nid).attr("id") + " .subjecticon.number tspan.special"),
      $("#" + $(nid).attr("id") + " .subjecticon.number tspan.normal")[0]
        .textContent,
      ""
    );

    $.each($(".connect.f" + $(nid).attr("id")), function (a, b) {
      toggle($(b), "highlight");
    });
  }