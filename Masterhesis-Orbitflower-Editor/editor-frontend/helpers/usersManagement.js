function storeOriginalUserStates() {
    originalUserStates = [];
    $('#users table').each(function() {
      originalUserStates.push({
        element: this,
        hidden: $(this).hasClass('hidden')
      });
    });
  }

  function restoreOriginalUserStates() {
    originalUserStates.forEach(state => {
      $(state.element).toggleClass('hidden', state.hidden);
    });
  }
  
  
  $('#details-skills').on('click', '.skill-item', function() {
    console.log("niceee you clicked a skill item", this);
    $('.skill-item').removeClass('selected'); // remove class from all
    $(this).addClass('selected');

    console.log("Selected skill item:", $(this).data('skill-id'));
  });


  function storeOriginalSkillStates() {
    originalSkillStates = [];
    $('#details-skills .skill-item').each(function() {
      originalSkillStates.push({
        element: this,
        hidden: $(this).hasClass('hidden')
      });
    });
  }
  function restoreOriginalSkillStates() {
    originalSkillStates.forEach(state => {
      $(state.element).toggleClass('hidden', state.hidden);
    });
  }


  $('svg').on('click', '.skill-segment', function(e) {
    const skillSegment = $(this);
    const parentNode = skillSegment.closest('[id]');
    if (!isZoomed) {
     unitId = document.querySelector(`text[id="${parentNode.attr('id')}_text"]`)?.textContent;
    }
    const skillId = skillSegment.attr('data-skill-id');
    const key = `${unitId}_${skillId}`;

    if (activeSkillSegments[key]) {
      delete activeSkillSegments[key];
      skillSegment.css('fill', '');
      
      if (Object.keys(activeSkillSegments).length === 0) {
        restoreOriginalUserStates();
      }
    } else {
      if (Object.keys(activeSkillSegments).length === 0) {
        storeOriginalUserStates();
      }
      
      activeSkillSegments = {};
      $('.skill-segment').css('fill', '');
      
      activeSkillSegments[key] = true;
      relatedSkills = getAllRelatedSkills(skillId);
      filterUsersByUnitAndSkill(unitId, relatedSkills);
      skillSegment.css('fill', '#4CAF50');
    }

    $('#details-skills .skill-item').removeClass('active');
    relatedSkills.forEach(skillId => {
      $(`#details-skills .skill-item[data-skill-id="${skillId}"]`).addClass('active');
    });
  });



  function filterUsersByUnitAndSkill(unitId, skillIds) {
    const skillIdsArray = Array.isArray(skillIds) ? skillIds : [skillIds];
    $('#users table').each(function() {
      const $userRow = $(this);
      const userId = $userRow.attr('data-uid');
      const inUnit = $(`subject[uid="${userId}"] relation[unit="${unitId}"], subject[uid="${userId}"] relation[role="${unitId}"]`, currentorgmodel).length > 0;
      let hasSkill = false;
      skillIdsArray.forEach(skillId => {
        if ($(`subject[uid="${userId}"] subjectSkills skillRef[id="${skillId}"]`, currentorgmodel).length > 0) {
          hasSkill = true;
        }
      });         
      $userRow.toggleClass('hidden', !(inUnit && hasSkill)).toggleClass('highlight-skill', inUnit && hasSkill);
    });
  }

  function getAllRelatedSkills(skillId) {
    const skills = new Set();
    const visited = new Set();

    function traverse(currentSkillId) {
      if (visited.has(currentSkillId)) 
        return;
      visited.add(currentSkillId);
      skills.add(currentSkillId);

      // Find Parent relations in the current skill
      $(`skill[id="${currentSkillId}"] relation[type="Parent"]`, currentorgmodel).each(function() {
        const parentId = $(this).attr('id');
        if (parentId && !visited.has(parentId)) {
          traverse(parentId);
        }
      });

      // Find skills that have Child relations pointing to the current skill (current skill is their parent)
      $(`skill relation[type="Child"][id="${currentSkillId}"]`, currentorgmodel).each(function() {
        const parentSkillId = $(this).closest('skill').attr('id');
        if (parentSkillId && !visited.has(parentSkillId)) {
          traverse(parentSkillId);
        }
      });
    }

    traverse(skillId);

    return Array.from(skills);
  }