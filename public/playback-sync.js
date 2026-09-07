/* Keep preview/export state aligned with timing and audio-selection controls. */
(() => {
  if (typeof state === 'undefined' || typeof stop !== 'function' || !document.querySelector('#segment')) return;

  const invalidateActivePlayback = reason => {
    if (state.playing) {
      recordDiagnostic('preview-invalidated', { reason });
      stop(false);
    }
    if (state.exportAbort) {
      recordDiagnostic('export-invalidated', { reason });
      cleanupExport({ discard: true, resetUI: true, redraw: false });
    }
  };

  $('#segment').oninput = () => {
    invalidateActivePlayback('segment-change');
    updateTimeline();
    draw(0);
  };

  $$('.duration').forEach(button => button.onclick = () => {
    invalidateActivePlayback('duration-change');
    state.duration = Number(button.dataset.duration);
    syncDurationOptions();
    updateTimeline();
    draw(0);
  });

  $$('.destination').forEach(button => button.onclick = () => {
    invalidateActivePlayback('destination-change');
    state.preset = button.dataset.preset;
    $$('.destination').forEach(item => {
      item.classList.toggle('active', item === button);
      item.setAttribute('aria-checked', item === button);
    });
    updatePreset();
  });

  const loadAudioBase = loadAudio;
  loadAudio = async file => {
    invalidateActivePlayback('audio-replacement');
    return loadAudioBase(file);
  };
})();
